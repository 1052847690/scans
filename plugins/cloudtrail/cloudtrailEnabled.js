var async = require('async');
var helpers = require('../../helpers');

module.exports = {
	title: 'CloudTrail Enabled',
	category: 'CloudTrail',
	description: 'Ensures CloudTrail is enabled for all regions within an account',
	more_info: 'CloudTrail should be enabled for all regions in order to detect suspicious activity in regions that are not typically used.',
	recommended_action: 'Enable CloudTrail for all regions and ensure that at least one region monitors global service events',
	link: 'http://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-getting-started.html',

	run: function(AWSConfig, cache, includeSource, callback) {
		var results = [];
		var source = {};

		var globalServicesMonitored = false;

		async.each(helpers.regions.cloudtrail, function(region, cb){
			var describeTrails = (cache.cloudtrail &&
								  cache.cloudtrail.describeTrails &&
								  cache.cloudtrail.describeTrails[region]) ?
								  cache.cloudtrail.describeTrails[region] : null;

			if (includeSource) {
				source['describeTrails'] = {};
				source['describeTrails'][region] = describeTrails;
			}

			if (!describeTrails || describeTrails.err || !describeTrails.data) {
				helpers.addResult(3, 'Unable to query for CloudTrail policy', region);
				return rcb();
			}

			if (!describeTrails.data.length) {
				helpers.addResult(2, 'CloudTrail is not enabled', region);
			} else if (describeTrails.data[0]) {
				helpers.addResult(0, 'CloudTrail is enabled', region);
				
				if (describeTrails.data[0].IncludeGlobalServiceEvents) {
					globalServicesMonitored = true;
				}
			} else {
				helpers.addResult(2, 'CloudTrail is enabled but is not properly configured', region);
			}
			cb();
		}, function(){
			if (!globalServicesMonitored) {
				helpers.addResult(2, 'CloudTrail is not monitoring global services');
			} else {
				helpers.addResult(0, 'CloudTrail is monitoring global services');
			}

			callback(null, results, source);
		});
	}
};