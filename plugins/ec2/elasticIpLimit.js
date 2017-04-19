var async = require('async');
var helpers = require('../../helpers');

module.exports = {
	title: 'Elastic IP Limit',
	category: 'EC2',
	description: 'Determine if the number of allocated EIPs is close to the AWS per-account limit',
	more_info: 'AWS limits accounts to certain numbers of resources. Exceeding those limits could prevent resources from launching.',
	recommended_action: 'Contact AWS support to increase the number of EIPs available',
	link: 'http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html#using-instance-addressing-limit',
	apis: ['EC2:describeAccountAttributes', 'EC2:describeAddresses'],

	run: function(cache, includeSource, callback) {
		var results = [];
		var source = {};

		async.each(helpers.regions.ec2, function(region, rcb){
			var describeAccountAttributes = (cache.ec2 &&
										  	 cache.ec2.describeAccountAttributes &&
										  	 cache.ec2.describeAccountAttributes[region]) ?
										  	 cache.ec2.describeAccountAttributes[region] : null;

			if (!describeAccountAttributes) return rcb();

			if (describeAccountAttributes.err || !describeAccountAttributes.data) {
				helpers.addResult(results, 3, 'Unable to query for account limits', region);
				return rcb();
			}

			var limits = {
				'max-elastic-ips': 5
			};

			// Loop through response to assign custom limits
			for (i in describeAccountAttributes.data) {
				if (limits[describeAccountAttributes.data[i].AttributeName]) {
					limits[describeAccountAttributes.data[i].AttributeName] = describeAccountAttributes.data[i].AttributeValues[0].AttributeValue;
				}
			}

			var describeAddresses = (cache.ec2 &&
									 cache.ec2.describeAddresses &&
									 cache.ec2.describeAddresses[region]) ?
									 cache.ec2.describeAddresses[region] : null;

			if (!describeAddresses) return rcb();

			if (describeAddresses.err || !describeAddresses.data) {
				helpers.addResult(results, 3, 'Unable to describe addresses for Elastic IP limit', region);
				return rcb();
			}
			
			if (!describeAddresses.data.length) {
				helpers.addResult(results, 0, 'No Elastic IPs found', region);
				return rcb();
			}

			// If EIPs exist, determine type of each
			var eips = 0;

			for (i in describeAddresses.data) {
				if (describeAddresses.data[i].Domain !== 'vpc') { eips++; }
			}

			var returnMsg = 'Account contains ' + eips + ' of ' + limits['max-elastic-ips'] + ' available Elastic IPs';

			if (eips === 0) {
				helpers.addResult(results, 0, 'No Elastic IPs found', region);
			} else if (eips === limits['max-elastic-ips'] - 1) {
				helpers.addResult(results, 1, returnMsg, region);
			} else if (eips >= limits['max-elastic-ips']) {
				helpers.addResult(results, 2, returnMsg, region);
			}
			
			rcb();
		}, function(){
			if (includeSource) {
				source = {
					describeAccountAttributes: (cache.ec2 && cache.ec2.describeAccountAttributes) ?
									 			cache.ec2.describeAccountAttributes : null,
					describeAddresses: (cache.ec2 && cache.ec2.describeAddresses) ?
									 	cache.ec2.describeAddresses : null
				}
			}

			return callback(null, results, source);
		});
	}
};