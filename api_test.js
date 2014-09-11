#!/usr/bin/env node
'use strict';

var the_policy = require('./config').policy,
  the_user = require('./config').user,
  the_app_rules = require('./config').app_rules,
  Api = require('./api'),
  api = new Api();

function run_the_bacon() {
  var app_rules_created = 0,
    target_user,
    target_policy;
  api.find_policy(the_policy.name);
  api.on('policy-found', function(err, policy){
    console.log('####### POLICY ############');
    console.log(policy);
    api.delete_policy(policy);
  });
  api.on('policy-missing', function(err){
    console.log('no policy going to create');
    api.create_policy(the_policy);
  });
  api.on('policy-created', function(err, policy){
    console.log('policy-created' + JSON.stringify(policy));
    target_policy = policy;
    the_app_rules.forEach(function(app_rule){
      console.log(policy.id);
      api.create_app_rule(policy.id, app_rule);
    });
  });
  api.on('policy-deleted', function(err){
    console.log('policy delete, going to create');
    target_policy = null;
    api.create_policy(the_policy);
  });
  api.on('policy-published', function(err, policy){
    console.log('policy: ' + policy.name + 'published');
    if(!target_user){
      api.find_user(the_user.username);
    }
  });
  api.on('app-rule-created', function(err, app_rule){
    app_rules_created +=1;
    if(app_rules_created >= the_app_rules.length){
      api.publish_policy(target_policy);
    }
  });

  api.on('user-found', function(err, user){
    api.delete_user(user);
  });

  api.on('user-missing', function(err){
    api.create_user(the_user);
  });

  api.on('user-deleted', function(err){
    api.create_user(the_user);
  })

  api.on('user-created', function(err, user){
    target_user = user;
    api.create_space({'user_id': user.id});
  });

}

api.on('ready', run_the_bacon);

api.on('failed', function(error, msg){
  console.log('sadness: ' + error + ' : ' + msg);
});

api.login();
