var async = require('async');
var helpers = require('../../helpers');

module.exports = {
	title: 'CloudTrail Bucket Access Logging',
	category: 'CloudTrail',
	description: 'Ensures CloudTrail logging bucket has access logging enabled to detect tampering of log files',
	more_info: 'CloudTrail buckets should utilize access logging for an additional layer of auditing. If the log files are deleted or modified in any way, the additional access logs can help determine who made the changes.',
	recommended_action: 'Enable access logging on the CloudTrail bucket from the S3 console',
	link: 'http://docs.aws.amazon.com/AmazonS3/latest/UG/ManagingBucketLogging.html',

	run: function(cache, includeSource, callback) {
		var results = [];
		var source = {};

		async.each(helpers.regions.cloudtrail, function(region, rcb){

			var describeTrails = (cache.cloudtrail &&
								  cache.cloudtrail.describeTrails &&
								  cache.cloudtrail.describeTrails[region]) ?
								  cache.cloudtrail.describeTrails[region] : null;

			if (!describeTrails) return rcb();

			if (describeTrails.err || !describeTrails.data) {
				helpers.addResult(results, 3, 'Unable to query for CloudTrail policy', region);
				return rcb();
			}

			if (!describeTrails.data.length) {
				helpers.addResult(results, 0, 'No S3 buckets to check', region);
				return rcb();
			}

			async.each(describeTrails.data, function(trail, cb){
				var getBucketLogging = (cache.s3 &&
										cache.s3.getBucketLogging &&
										cache.s3.getBucketLogging['us-east-1'] &&
										cache.s3.getBucketLogging['us-east-1'][trail.S3BucketName]) ?
										cache.s3.getBucketLogging['us-east-1'][trail.S3BucketName] : null;

				if (!getBucketLogging || getBucketLogging.err || !getBucketLogging.data) {
					helpers.addResult(results, 3,
						'Error querying for bucket policy for bucket: ' + trail.S3BucketName,
						region, 'arn:aws:s3:::' + trail.S3BucketName)

					return cb();
				}

				if (getBucketLogging &&
					getBucketLogging.data &&
					getBucketLogging.data.LoggingEnabled) {
					helpers.addResult(results, 0,
						'Bucket: ' + trail.S3BucketName + ' has S3 access logs enabled',
						region, 'arn:aws:s3:::' + trail.S3BucketName);
				} else {
					helpers.addResult(results, 1,
						'Bucket: ' + trail.S3BucketName + ' has S3 access logs disabled',
						region, 'arn:aws:s3:::' + trail.S3BucketName);
				}

				cb();
			}, function(){
				rcb();
			});
		}, function(){
			if (includeSource) {
				source = {
					getBucketLogging: (cache.s3 && cache.s3.getBucketLogging) ?
									   cache.s3.getBucketLogging : null,
					describeTrails: (cache.cloudtrail && cache.cloudtrail.describeTrails) ?
									 cache.cloudtrail.describeTrails : null
				}
			}

			callback(null, results, source);
		});
	}
};