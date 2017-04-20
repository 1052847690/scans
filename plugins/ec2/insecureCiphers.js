// TODO: come back to this one
var async = require('async');
var helpers = require('../../helpers');

var badCiphers = [
	'Protocol-SSLv2',
	'Protocol-SSLv3',
	'DHE-RSA-AES128-SHA',
	'DHE-DSS-AES128-SHA',
	'CAMELLIA128-SHA',
	'EDH-RSA-DES-CBC3-SHA',
	'ECDHE-RSA-RC4-SHA',
	'RC4-SHA',
	'ECDHE-ECDSA-RC4-SHA',
	'DHE-DSS-AES256-GCM-SHA384',
	'DHE-RSA-AES256-GCM-SHA384',
	'DHE-RSA-AES256-SHA256',
	'DHE-DSS-AES256-SHA256',
	'DHE-RSA-AES256-SHA',
	'DHE-DSS-AES256-SHA',
	'DHE-RSA-CAMELLIA256-SHA',
	'DHE-DSS-CAMELLIA256-SHA',
	'CAMELLIA256-SHA',
	'EDH-DSS-DES-CBC3-SHA',
	'DHE-DSS-AES128-GCM-SHA256',
	'DHE-RSA-AES128-GCM-SHA256',
	'DHE-RSA-AES128-SHA256',
	'DHE-DSS-AES128-SHA256',
	'DHE-RSA-CAMELLIA128-SHA',
	'DHE-DSS-CAMELLIA128-SHA',
	'ADH-AES128-GCM-SHA256',
	'ADH-AES128-SHA',
	'ADH-AES128-SHA256',
	'ADH-AES256-GCM-SHA384',
	'ADH-AES256-SHA',
	'ADH-AES256-SHA256',
	'ADH-CAMELLIA128-SHA',
	'ADH-CAMELLIA256-SHA',
	'ADH-DES-CBC3-SHA',
	'ADH-DES-CBC-SHA',
	'ADH-RC4-MD5',
	'ADH-SEED-SHA',
	'DES-CBC-SHA',
	'DHE-DSS-SEED-SHA',
	'DHE-RSA-SEED-SHA',
	'EDH-DSS-DES-CBC-SHA',
	'EDH-RSA-DES-CBC-SHA',
	'IDEA-CBC-SHA',
	'RC4-MD5',
	'SEED-SHA',
	'DES-CBC3-MD5',
	'DES-CBC-MD5',
	'RC2-CBC-MD5',
	'PSK-AES256-CBC-SHA',
	'PSK-3DES-EDE-CBC-SHA',
	'KRB5-DES-CBC3-SHA',
	'KRB5-DES-CBC3-MD5',
	'PSK-AES128-CBC-SHA',
	'PSK-RC4-SHA',
	'KRB5-RC4-SHA',
	'KRB5-RC4-MD5',
	'KRB5-DES-CBC-SHA',
	'KRB5-DES-CBC-MD5',
	'EXP-EDH-RSA-DES-CBC-SHA',
	'EXP-EDH-DSS-DES-CBC-SHA',
	'EXP-ADH-DES-CBC-SHA',
	'EXP-DES-CBC-SHA',
	'EXP-RC2-CBC-MD5',
	'EXP-KRB5-RC2-CBC-SHA',
	'EXP-KRB5-DES-CBC-SHA',
	'EXP-KRB5-RC2-CBC-MD5',
	'EXP-KRB5-DES-CBC-MD5',
	'EXP-ADH-RC4-MD5',
	'EXP-RC4-MD5',
	'EXP-KRB5-RC4-SHA',
	'EXP-KRB5-RC4-MD5'
];

module.exports = {
	title: 'Insecure Ciphers',
	category: 'EC2',
	description: 'Detect use of insecure ciphers on ELBs',
	more_info: 'Various security vulnerabilities have rendered several ciphers insecure. Only the recommended ciphers should be used.',
	link: 'http://docs.aws.amazon.com/ElasticLoadBalancing/latest/DeveloperGuide/elb-security-policy-options.html',
	recommended_action: 'Update your ELBs to use the recommended cipher suites',
	apis: ['EC2:describeLoadBalancers', 'EC2:describeLoadBalancerPolicies'],

	run: function(cache, callback) {
		var results = [];
		var source = {};

		async.each(helpers.regions.elb, function(region, rcb){
			var describeLoadBalancers = helpers.addSource(cache, source,
				['elb', 'describeLoadBalancers', region]);

			if (!describeLoadBalancers) return rcb();

			if (describeLoadBalancers.err || !describeLoadBalancers.data) {
				helpers.addResult(results, 3, 'Unable to query for load balancers', region);
				return rcb();
			}

			// Gather list of policies from load balancers
			var policies = [];

			for (i in describeLoadBalancers.data) {
				for (j in describeLoadBalancers.data[i].ListenerDescriptions) {
					if (describeLoadBalancers.data[i].ListenerDescriptions[j].Listener.Protocol === 'HTTPS') {
						var elbPolicies = [];
						for (k in describeLoadBalancers.data[i].ListenerDescriptions[j].PolicyNames) {
							elbPolicies.push(describeLoadBalancers.data[i].ListenerDescriptions[j].PolicyNames[k]);
						}
						if (elbPolicies.length) {
							var elbObj = {
								LoadBalancerName: describeLoadBalancers.data[i].LoadBalancerName,
								LoadBalancerDNS: describeLoadBalancers.data[i].DNSName,
								PolicyNames: elbPolicies
							};
							policies.push(elbObj);
						}
					}
				}
			}

			if (!policies.length) {
				helpers.addResult(results, 0, 'No load balancers are using HTTPS', region);
				return rcb();
			}

			async.each(policies, function(policy, cb){
				var describeLoadBalancerPolicies = helpers.addSource(cache, source,
					['elb', 'describeLoadBalancerPolicies', region]);

				var describeLoadBalancerPolicies = (cache.elb &&
											 cache.elb.describeLoadBalancerPolicies &&
											 cache.elb.describeLoadBalancerPolicies[region]) ?
											 cache.elb.describeLoadBalancerPolicies[region] : null;

				if (!describeLoadBalancerPolicies || describeLoadBalancerPolicies.err || !describeLoadBalancerPolicies.data) {
					helpers.addResult(results, 3, 'Unable to query for load balancers', region);
					return rcb();
				}

				elb.describeLoadBalancerPolicies({LoadBalancerName: policy.LoadBalancerName, PolicyNames:policy.PolicyNames}, function(err, data){
					if (err || !data || !data.PolicyDescriptions) {
						results.push({
							status: 3,
							message: 'Unable to query load balancer policies for ELB: ' + policy.LoadBalancerName,
							region: region,
							resource: policy.LoadBalancerDNS,
						});
						return cb();
					}

					for (i in data.PolicyDescriptions) {
						var elbBad = [];
						for (j in data.PolicyDescriptions[i].PolicyAttributeDescriptions) {
							if (data.PolicyDescriptions[i].PolicyAttributeDescriptions[j].AttributeValue === 'true' && badCiphers.indexOf(data.PolicyDescriptions[i].PolicyAttributeDescriptions[j].AttributeName) > -1) {
								elbBad.push(data.PolicyDescriptions[i].PolicyAttributeDescriptions[j].AttributeName);
							}
						}
						if (elbBad.length) {
							results.push({
								status: 1,
								message: 'ELB: ' + policy.LoadBalancerName + ' uses insecure protocols or ciphers: ' + elbBad.join(', '),
								region: region,
								resource: policy.LoadBalancerDNS,
							});
						} else {
							results.push({
								status: 0,
								message: 'ELB: ' + policy.LoadBalancerName + ' uses secure protocols and ciphers',
								region: region,
								resource: policy.LoadBalancerDNS,
							});
						}
					}
					cb();
				});
			}, function(){
				rcb();
			});
		}, function(){
			callback(null, results, source);
		});
	}
};