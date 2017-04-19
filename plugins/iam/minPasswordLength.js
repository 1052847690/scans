var helpers = require('../../helpers');

module.exports = {
	title: 'Minimum Password Length',
	category: 'IAM',
	description: 'Ensures password policy requires a password of at least 14 characters',
	more_info: 'A strong password policy enforces minimum length, expirations, reuse, and symbol usage',
	link: 'http://docs.aws.amazon.com/IAM/latest/UserGuide/Using_ManagingPasswordPolicies.html',
	recommended_action: 'Increase the minimum length requirement for the password policy',
	apis: ['IAM:getAccountPasswordPolicy'],

	run: function(cache, includeSource, callback) {
		var results = [];
		var source = {};

		var region = 'us-east-1';

		var getAccountPasswordPolicy = (cache.iam &&
						  				cache.iam.getAccountPasswordPolicy &&
						  				cache.iam.getAccountPasswordPolicy[region]) ?
						  				cache.iam.getAccountPasswordPolicy[region] : null;

		if (!getAccountPasswordPolicy) return callback(null, results, source);

		if (getAccountPasswordPolicy.err || !getAccountPasswordPolicy.data) {
			helpers.addResult(results, 3, 'Unable to query for password policy status');
			return callback(null, results, source);
		}

		if (!getAccountPasswordPolicy.MinimumPasswordLength) {
			helpers.addResult(results, 2, 'Password policy does not specify a minimum password length');
		} else if (getAccountPasswordPolicy.MinimumPasswordLength < 10) {
			helpers.addResult(results, 2, 'Minimum password length of: ' + getAccountPasswordPolicy.MinimumPasswordLength + ' is less than 10 characters');
		} else if (getAccountPasswordPolicy.MinimumPasswordLength < 14) {
			helpers.addResult(results, 1, 'Minimum password length of: ' + getAccountPasswordPolicy.MinimumPasswordLength + ' is less than 14 characters');
		} else {
			helpers.addResult(results, 0, 'Minimum password length of: ' + getAccountPasswordPolicy.MinimumPasswordLength + ' is suitable');
		}

		if (includeSource) {
			source = {
				getAccountPasswordPolicy: (cache.iam && cache.iam.getAccountPasswordPolicy) ?
							 			   cache.iam.getAccountPasswordPolicy : null
			};
		}

		callback(null, results, source);
	}
};