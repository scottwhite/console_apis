'use strict';
var request = require('request'),
  creds = require('./config').creds,
  baseurl = creds.baseurl,
  util = require('util'),
  EventEmitter = require('events').EventEmitter;

function api() {
  const PUBLISHED = 0,
  EDITED = 1,
  PUBLISHING = 2,
  POLICY_DELETED = 3,
  POLICY_DELETING = 4;

  var self = this;
  EventEmitter.call(self);

  request = request.defaults({
    jar: true
  });

  function process_request(options, cb) {
    request(options, function(error, response, body) {
      if (error) {
        console.log(error);
        return;
      }
      if (response.statusCode >= 300) {
        var msg = 'no message returned';
        if (body) {
          if (body.hasOwnProperty('msg')) {
            msg = body.msg;
          } else {
            msg = JSON.parse(body).msg;
          }
        }
        if (options.use_callback) {
          cb(true, msg);
        } else {
          self.emit('failed', response.statusCode, msg);
        }

        return;
      }
      try {
        if (cb) {
          if (body) {
            if (typeof body == 'string') {
              cb(null, JSON.parse(body));
            } else {
              cb(null, body);
            }
          } else {
            cb(null, true);
          }
        }
      } catch (e) {
        console.log(e);
        self.emit('failed', e, null);
      }
      return;
    });
  }


  function policies(cb) {
    var url = baseurl + '/api/policies';
    process_request({
      'url': url,
      'method': 'get'
    }, cb);
    return;
  }

  function get_policy(policy_id, cb) {
    var url = baseurl + '/api/policies/' + policy_id;
    process_request({
      'url': url,
      'method': 'get'
    }, cb);
    return;
  }


  function find_policy(policy_name) {
    policies(function(err, ps) {
      if (!ps) {
        return;
      }

      function match_policy(policies) {
        var have_policy = false;
        policies.some(function(policy) {
          if (policy.policy_groups[0].name == policy_name) {
            self.target_policy = policy;
            have_policy = true;
            // get the details, the list is goofy 
            get_policy(policy.policy_groups[0].id, function(err, policy_details) {
              self.emit('policy-found', null, policy_details);
            });
            return true;
          }
        });
        if (!have_policy) {
          self.emit('policy-missing', 'no policy', null);
        }
      }
      match_policy(ps);
    });
    return;
  }

  function create_policy(data) {
    var url = baseurl + '/api/policies';
    process_request({
      'url': url,
      'method': 'post',
      'json': data
    }, function(err, policy) {
      self.emit('policy-created', null, policy);
    });
  }


  function delete_policy(policy) {
    var url = baseurl + '/api/policies/' + policy.id;
    process_request({
        'url': url,
        'method': 'delete',
        'use_callback': true,
      },
      function(err, msg) {
        if (err && msg == 'Cannot change policy state to deleted when it is deleted.') {
          console.log('policy has already been deleted, publishing');
          publish_policy(policy);
        } else {
          publish_policy(policy);
        }
      });
  }

  function is_published(policy, checktime) {
    checktime = checktime || 0;
    var have_policy = false;
    policies(function(err, ps) {
      ps.forEach(function(p) {
        if (p.policy_groups[0].id == policy.id) {
          policy.state = p.state;
          console.log('policy state: ' + p.state);
          have_policy = true;
          if (p.state == PUBLISHED) { //published
            self.emit('policy-published', null, policy);
          } else {
            if (checktime > 10) {
              self.emit('failed', 'unable to verify if policy ' + policy.id + ' was published', policy);
              return;
            }
            setTimeout(function() {
              is_published(policy, checktime + 1);
            }, 5000);
          }
        }
      });
      console.log(policy);
      if (!have_policy) {
        console.log('policy ' + policy.id + ' deleted');
        self.emit('policy-deleted', null, self);
      }
    });
  }

  function publish_policy(policy) {
    var url = baseurl + '/api/policies/' + policy.id + '/publish';
    process_request({
      'url': url,
      'method': 'post'
    }, function(err) {
      is_published(policy);
    });
  }

  function find_user(username) {
    var url = baseurl + '/api/users/' + username;
    process_request({
      'url': url,
      'method': 'get',
      'use_callback': true,
    }, function(err, data) {
      console.log(data);
      if (err) {
        self.emit('user-missing', null, data);
      } else {
        self.emit('user-found', null, data);
      }

    });
  }

  function users() {
    var url = baseurl + '/api/users';
    process_request({
      'url': url,
      'method': 'get'
    }, function(err, users) {
      self.emit('users', null, users);
    });
  }

  function create_user(data) {
    var url = baseurl + '/api/users';
    process_request({
      'url': url,
      'method': 'post',
      'json': data,
    }, function(err, user) {
      self.emit('user-created', null, user);
    });
  }

  function delete_user(user) {
    var url = baseurl + '/api/users/' + user.id;
    process_request({
      'url': url,
      'method': 'delete'
    }, function(err) {
      self.emit('user-deleted', null, self);
    });
  }


  function create_space(data) {
    var url = baseurl + '/api/spaces';
    process_request({
      'url': url,
      'method': 'post',
      'json': data,
    }, function(err, space) {
      self.emit('space-created', null, space);
    });
  }

  function create_app_rule(policy_id, data) {
    var url = baseurl + '/api/policies/' + policy_id + '/apprules';
    process_request({
      'url': url,
      'method': 'post',
      'json': data
    }, function(err, app_rule) {
      self.emit('app-rule-created', null, app_rule);
    });
  }

  function app_rules(policy_id, cb) {
    var url = baseurl + '/api/policies/' + policy_id + '/apprules';
    process_request({
      'url': url,
      'method': 'get'
    }, cb);
  }

  function login() {
    var url = baseurl + '/api/login';
    request.post({
        'url': url,
        'json': {
          'username': creds.username,
          'password': creds.password
        }
      },
      function(error, response, body) {
        if (error) {
          console.log(error);
          self.emit('failed', error, null);
          return;
        }
        if (response.statusCode != 200) {
          self.emit('failed', response.statusCode, body);
          return;
        }
        if (response.statusCode == 200) {
          self.emit('ready', null, self);
          return;
        }
      }
    );
  }

  self.login = login;
  self.find_policy = find_policy;
  self.delete_policy = delete_policy;
  self.policies = policies;
  self.create_policy = create_policy;
  self.publish_policy = publish_policy;
  self.is_published = is_published;
  self.find_user = find_user;
  self.users = users;
  self.delete_user = delete_user;
  self.create_user = create_user;
  self.create_space = create_space;
  self.create_app_rule = create_app_rule;
  self.app_rules = app_rules;

  return self;
}

util.inherits(api, EventEmitter);

module.exports = api;