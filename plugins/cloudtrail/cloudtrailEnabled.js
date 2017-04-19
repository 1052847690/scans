var async = require('async');
var helpers = require('../../helpers');

module.exports = {
	title: 'CloudTrail Enabled',
	category: 'CloudTrail',
	description: 'Ensures CloudTrail is enabled for all regions within an account',
	more_info: 'CloudTrail should be enabled for all regions in order to detect suspicious activity in regions that are not typically used.',
	recommended_action: 'Enable CloudTrail for all regions and ensure that at least one region monitors global service events',
	link: 'http://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-getting-started.html',
	apis: ['CloudTrail:describeTrails'],

	run: function(cache, includeSource, callback) {
		var results = [];
		var source = {};

		var globalServicesMonitored = false;

		async.each(helpers.regions.cloudtrail, function(region, cb){
			var describeTrails = (cache.cloudtrail &&
								  cache.cloudtrail.describeTrails &&
								  cache.cloudtrail.describeTrails[region]) ?
								  cache.cloudtrail.describeTrails[region] : null;

			if (!describeTrails) return cb();

			if (describeTrails.err || !describeTrails.data) {
				helpers.addResult(results, 3, 'Unable to query for CloudTrail policy', region);
				return rcb();
			}

			if (!describeTrails.data.length) {
				helpers.addResult(results, 2, 'CloudTrail is not enabled', region);
			} else if (describeTrails.data[0]) {
				helpers.addResult(results, 0, 'CloudTrail is enabled', region);
				
				if (describeTrails.data[0].IncludeGlobalServiceEvents) {
					globalServicesMonitored = true;
				}
			} else {
				helpers.addResult(results, 2, 'CloudTrail is enabled but is not properly configured', region);
			}
			cb();
		}, function(){
			if (!globalServicesMonitored) {
				helpers.addResult(results, 2, 'CloudTrail is not monitoring global services');
			} else {
				helpers.addResult(results, 0, 'CloudTrail is monitoring global services');
			}

			if (includeSource) {
				source = {
					describeTrails: (cache.cloudtrail && cache.cloudtrail.describeTrails) ?
									 cache.cloudtrail.describeTrails : null
				}
			}

			callback(null, results, source);
		});
	}
};