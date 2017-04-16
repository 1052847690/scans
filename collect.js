var AWS = require('aws-sdk');
var async = require('async');
var helpers = require(__dirname + '/helpers');
var collectors = require(__dirname + '/collectors');
var collection = {};

// OPTION 1: Configure AWS credentials through hard-coded key and secret
// var AWSConfig = {
//     accessKeyId: '',
//     secretAccessKey: '',
//     sessionToken: '',
//     region: 'us-east-1'
// };

// OPTION 2: Import an AWS config file containing credentials
// var AWSConfig = require(__dirname + '/credentials.json');

// OPTION 3: Set AWS credentials in environment variables

var AWSConfig = {};

var calls = {
	CloudFront: {
		listDistributions: {
			property: 'DistributionList',
			secondProperty: 'Items'
		}
	},
	CloudTrail: {
		describeTrails: {
			property: 'trailList'
		}
	},
	ConfigService: {
		describeConfigurationRecorders: {
			property: 'ConfigurationRecorders'
		},
		describeConfigurationRecorderStatus: {
			property: 'ConfigurationRecordersStatus'
		}
	},
	EC2: {
		describeAccountAttributes: {
			property: 'AccountAttributes'
		},
		describeAddresses: {
			property: 'Addresses'
		},
		describeInstances: {
			property: 'Reservations',
			params: {
				Filters: [
					{
						Name: 'instance-state-name',
						Values: [
							'pending',
							'running',
							'shutting-down',
							'stopping',
							'stopped'
						]
					}
				]
			}
		},
		describeSecurityGroups: {
			property: 'SecurityGroups'
		},
		describeVpcs: {
			property: 'Vpcs'
		},
		describeFlowLogs: {
			property: 'FlowLogs'
		}
	},
	ELB: {
		describeLoadBalancers: {
			property: 'LoadBalancerDescriptions'
		}
	},
	IAM: {
		listServerCertificates: {
			property: 'ServerCertificateMetadataList'
		},
		listGroups: {
			property: 'Groups'
		},
		listUsers: {
			property: 'Users'
		},
		getAccountPasswordPolicy: {
			property: 'PasswordPolicy'
		},
		generateCredentialReport: {
			override: true
		}
	},
	KMS: {
		listKeys: {
			property: 'Keys'
		}
	},
	RDS: {
		describeDBInstances: {
			property: 'DBInstances'
		},
		describeDBClusters: {
			property: 'DBClusters'
		}
	},
	Route53Domains: {
		listDomains: {
			property: 'Domains'
		}
	},
	S3: {
		listBuckets: {
			property: 'Buckets'
		}
	},
	SES: {
		listIdentities: {
			property: 'Identities',
			params: {IdentityType: 'Domain'},	// TODO: maybe don't filter these?
			rateLimit: 1000	// ms to rate limit between regions
		}
	}
};

var postcalls = [
	{
		// TODO: handle bucket retries for non-us-east locations
		S3: {
			getBucketLogging: {
				deleteRegion: true,
				signatureVersion: 'v4',
				reliesOnService: 'cloudtrail',
				reliesOnCall: 'describeTrails',
				filterKey: 'Bucket',
				filterValue: 'S3BucketName'
			},
			getBucketVersioning: {
				deleteRegion: true,
				signatureVersion: 'v4',
				reliesOnService: 'cloudtrail',
				reliesOnCall: 'describeTrails',
				filterKey: 'Bucket',
				filterValue: 'S3BucketName'
			},
			getBucketAcl: {
				deleteRegion: true,
				signatureVersion: 'v4',
				reliesOnService: 'cloudtrail',
				reliesOnCall: 'describeTrails',
				filterKey: 'Bucket',
				filterValue: 'S3BucketName'
			}
		},
		EC2: {
			describeSubnets: {
				reliesOnService: 'ec2',
				reliesOnCall: 'describeVpcs',
				override: true
			}
		},
		ELB: {
			describeLoadBalancerPolicies: {
				reliesOnService: 'elb',
				reliesOnCall: 'describeLoadBalancers',
				override: true
			}
		},
		IAM: {
			getGroup: {
				reliesOnService: 'iam',
				reliesOnCall: 'listGroups',
				filterKey: 'GroupName',
				filterValue: 'GroupName'
			},
			listAttachedUserPolicies: {
				reliesOnService: 'iam',
				reliesOnCall: 'listUsers',
				filterKey: 'UserName',
				filterValue: 'UserName'
			},
			listUserPolicies: {
				reliesOnService: 'iam',
				reliesOnCall: 'listUsers',
				filterKey: 'UserName',
				filterValue: 'UserName'
			},
			listSSHPublicKeys: {
				reliesOnService: 'iam',
				reliesOnCall: 'listUsers',
				filterKey: 'UserName',
				filterValue: 'UserName'
			},
			listMFADevices: {
				reliesOnService: 'iam',
				reliesOnCall: 'listUsers',
				filterKey: 'UserName',
				filterValue: 'UserName'
			}
		},
		KMS: {
			describeKey: {
				reliesOnService: 'kms',
				reliesOnCall: 'listKeys',
				filterKey: 'KeyId',
				filterValue: 'KeyId'
			},
			getKeyRotationStatus: {
				reliesOnService: 'kms',
				reliesOnCall: 'listKeys',
				filterKey: 'KeyId',
				filterValue: 'KeyId'
			}
		},
		SES: {
			getIdentityDkimAttributes: {
				reliesOnService: 'ses',
				reliesOnCall: 'listIdentities',
				override: true,
				rateLimit: 1000
			}
		}
	}
];

// Loop through all of the top-level collectors for each service
async.eachOfLimit(calls, 10, function(call, service, serviceCb){
	var serviceLower = service.toLowerCase();

	if (!collection[serviceLower]) collection[serviceLower] = {};

	// Loop through each of the service's functions
	async.eachOfLimit(call, 10, function(callObj, callKey, callCb){
		if (!collection[serviceLower][callKey]) collection[serviceLower][callKey] = {};

		async.eachLimit(helpers.regions[serviceLower], helpers.MAX_REGIONS_AT_A_TIME, function(region, regionCb){
			//if (settings.skip_regions && settings.skip_regions.indexOf(region)) return regionCb();

			if (!collection[serviceLower][callKey][region]) collection[serviceLower][callKey][region] = {};

			var LocalAWSConfig = JSON.parse(JSON.stringify(AWSConfig));
			LocalAWSConfig.region = region;

			if (callObj.override) {
				collectors[serviceLower][callKey](LocalAWSConfig, collection, function(){
					if (callObj.rateLimit) {
						setTimeout(function(){
							regionCb();
						}, callObj.rateLimit);
					} else {
						regionCb();
					}
				});
			} else {
				var executor = new AWS[service](LocalAWSConfig);
				var executorCb = function(err, data){
					if (err) {
						collection[serviceLower][callKey][region].err = err;
					}
					
					// TODO: pagination
					// TODO: handle s3 region fixes (possibly use an override)
					if (!data) return regionCb();
					if (callObj.property && !data[callObj.property]) return regionCb();
					if (callObj.secondProperty && !data[callObj.secondProperty]) return regionCb();

					if (callObj.secondProperty) {
						collection[serviceLower][callKey][region].data = data[callObj.property][callObj.secondProperty];
					} else {
						collection[serviceLower][callKey][region].data = data[callObj.property];
					}

					if (callObj.rateLimit) {
						setTimeout(function(){
							regionCb();
						}, callObj.rateLimit);
					} else {
						regionCb();
					}
				};

				if (callObj.params) {
					executor[callKey](callObj.params, executorCb);
				} else {
					executor[callKey](executorCb);
				}
				
			}
		}, function(){
			callCb();
		});
	}, function(){
		serviceCb();
	});
}, function(){
	// Now loop through the follow up calls
	async.eachSeries(postcalls, function(postcallObj, postcallCb){
		async.eachOfLimit(postcallObj, 10, function(serviceObj, service, serviceCb){
			var serviceLower = service.toLowerCase();
			if (!collection[serviceLower]) collection[serviceLower] = {};

			async.eachOfLimit(serviceObj, 1, function(callObj, callKey, callCb){
				if (!collection[serviceLower][callKey]) collection[serviceLower][callKey] = {};
				
				async.eachLimit(helpers.regions[serviceLower], helpers.MAX_REGIONS_AT_A_TIME, function(region, regionCb){
					//if (settings.skip_regions && settings.skip_regions.indexOf(region)) return regionCb();
					if (!collection[serviceLower][callKey][region]) collection[serviceLower][callKey][region] = {};

					//console.log(service + ' ' + callKey + ' ' + region + ' ' + callObj.reliesOnService);

					// Ensure pre-requisites are met
					if (callObj.reliesOnService && !collection[callObj.reliesOnService]) return regionCb();

					if (callObj.reliesOnCall &&
						(!collection[callObj.reliesOnService] ||
						 !collection[callObj.reliesOnService][callObj.reliesOnCall] ||
						 !collection[callObj.reliesOnService][callObj.reliesOnCall][region] ||
						 !collection[callObj.reliesOnService][callObj.reliesOnCall][region].data ||
						 !collection[callObj.reliesOnService][callObj.reliesOnCall][region].data.length)) return regionCb();

					var LocalAWSConfig = JSON.parse(JSON.stringify(AWSConfig));
					if (callObj.deleteRegion) {
						delete LocalAWSConfig.region;
					} else {
						LocalAWSConfig.region = region;
					}
					if (callObj.signatureVersion) LocalAWSConfig.signatureVersion = callObj.signatureVersion;

					if (callObj.override) {
						collectors[serviceLower][callKey](LocalAWSConfig, collection, function(){
							if (callObj.rateLimit) {
								setTimeout(function(){
									regionCb();
								}, callObj.rateLimit);
							} else {
								regionCb();
							}
						});
					} else {
						var executor = new AWS[service](LocalAWSConfig);

						async.eachLimit(collection[callObj.reliesOnService][callObj.reliesOnCall][AWSConfig.region].data, 10, function(dep, depCb){
							collection[serviceLower][callKey][AWSConfig.region][dep[callObj.filterValue]] = {};

							var filter = {};
							filter[callObj.filterKey] = dep[callObj.filterValue];

							executor[callKey](filter, function(err, data){
								if (err) {
									collection[serviceLower][callKey][AWSConfig.region][dep[callObj.filterValue]].err = err;
								}

								collection[serviceLower][callKey][AWSConfig.region][dep[callObj.filterValue]].data = data;

								depCb();
							});
						}, function(){
							if (callObj.rateLimit) {
								setTimeout(function(){
									regionCb();
								}, callObj.rateLimit);
							} else {
								regionCb();
							}
						});
					}
				}, function(){
					callCb();
				});
			}, function(){
				serviceCb();
			});
		}, function(){
			postcallCb();
		});
	}, function(){
		console.log(JSON.stringify(collection, null, 2));
	});
});