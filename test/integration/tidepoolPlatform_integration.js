// == BSD2 LICENSE ==
// Copyright (c) 2014, Tidepool Project
//
// This program is free software; you can redistribute it and/or modify it under
// the terms of the associated License, which is identical to the BSD 2-Clause
// License as published by the Open Source Initiative at opensource.org.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the License for more details.
//
// You should have received a copy of the License along with this program; if
// not, you can obtain one from Tidepool Project at tidepool.org.
// == BSD2 LICENSE ==

'use strict';
var _ = require('lodash');
var async = require('async');
var expect = require('salinity').expect;
var superagent = require('superagent');

var platform = require('../../index.js');

describe('platform client', function () {

  /**
   * Timeout is used when running against the deployed services
   */
  this.timeout(10000);

  var mrT1Client = null;
  var careTeamClient = null;

  var mrT1 = {
    id: null,
    token: null,
    username: 'mrT1@user.com',
    password: 'mrT1',
    emails: ['mrT1@user.com'],
    firstName: 'Jamie',
    lastName: 'T1'
  };

  var careTeamMember = {
    id: null,
    token: null,
    username: 'team@member.com',
    password: 'teammember',
    emails: ['team@member.com'],
    firstName: 'Dr Doogie',
    lastName: 'Howser'
  };

  function createClient(user, cb) {
    var log = { info: console.log, warn: console.log };
    var client = platform({ host: 'http://localhost:8009' }, superagent, log);
    return client.login(user, function (error, data) {
      if (data && data.userid) {
        user.id = data.userid;
      }

      if (error) {
        return client.signup(user, function (error, data) {
          if (error) {
            return cb(error, null);
          }
          user.id = data.userid;
          return cb(null, client);
        });
      } else {
        return cb(null, client);
      }
    });
  }

  before(function (done) {
    async.parallel(
      [
        createClient.bind(null, mrT1),
        createClient.bind(null, careTeamMember)
      ],
      function(err, clients) {
        if (err != null) {
          return done(err);
        }
        mrT1Client = clients[0];
        careTeamClient = clients[1];
        done();
      }
    );
  });

  describe('sets up the profiles', function () {

    it('for mrT1', function (done) {
      mrT1Client.addOrUpdateProfile(mrT1, done);
    });

    it('for mrT1 we can get the profile', function (done) {
      mrT1Client.findProfile(mrT1.id, function (error, profile) {
        expect(error).to.not.exist;

        expect(profile).to.exist;
        expect(profile.firstName).to.equal(mrT1.firstName);
        expect(profile.lastName).to.equal(mrT1.lastName);
        expect(profile).to.not.have.property('password');
        expect(profile).to.not.have.property('username');

        done();
      });
    });

    it('for careTeamMember', function (done) {
      careTeamClient.addOrUpdateProfile(careTeamMember, done);
    });

    it('for careTeamMember we can get the profile', function (done) {
      careTeamClient.findProfile(careTeamMember.id, function (error, profile) {
        expect(error).to.not.exist;

        expect(profile).to.be.exist;
        expect(profile.firstName).to.equal(careTeamMember.firstName);
        expect(profile.lastName).to.equal(careTeamMember.lastName);
        expect(profile).to.not.have.property('password');
        expect(profile).to.not.have.property('username');
        done();
      });
    });

  });

  describe('get the team for mrT1', function () {

    it('returns the team group for mrT1', function (done) {
      mrT1Client.getUsersTeam(mrT1.id, function (error, team) {
        expect(error).to.not.exist;

        expect(team).to.exist;
        expect(team.members).to.exist;
        expect(team.members).to.be.a('array');
        expect(team.id).to.exist;
        done();
      });
    });

  });

  describe('messaging for mrT1', function () {
    var mrT1TeamId;
    var noteToAddId;
    var noteToAdd;
    var commentOnNote;

    before(function (done) {
      mrT1Client.getUsersTeam(mrT1.id, function (error, team) {
        if (error) {
          done(error);
          return;
        }
        mrT1TeamId = team.id;
        done();
      });
    });

    it('allows mrT1 to add a note', function (done) {

      noteToAdd = {
        userid: mrT1.id,
        groupid: mrT1.id,
        timestamp: new Date().toISOString(),
        messagetext: 'In three words I can sum up everything I have learned about life: it goes on.'
      };

      //add note
      mrT1Client.startMessageThread(noteToAdd, function (error, data) {
        expect(error).to.not.exist;
        expect(data).to.exist;
        noteToAddId = data;
        done();
      });
    });

    it('and add a comment on the note', function (done) {

      //comment on the note
      commentOnNote = {
        userid: mrT1.id,
        groupid: mrT1.id,
        parentmessage : noteToAddId,
        timestamp: new Date().toISOString(),
        messagetext: 'Good point bro!'
      };

      mrT1Client.replyToMessageThread(commentOnNote, done);
    });

    it('and then get the whole thread', function (done) {

      mrT1Client.getMessageThread(noteToAddId, function (error, data) {
        expect(error).to.not.exist;
        expect(data).to.exist;
        expect(data.length).to.equal(2);

        var note = _.filter(data, function(message) {
          return (!message.parentmessage);
        });
        var comment = _.filter(data, function(message) {
          return (message.parentmessage);
        });
        expect(comment.parentmessage).to.equal(note.id);
        done();
      });
    });

    it('allows mrT1 to get all messages for his team for the last two weeks', function (done) {


      var twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      var dates = {
        start: twoWeeksAgo ,
        end : new Date()
      };

      mrT1Client.getAllMessagesForUser(mrT1.id, dates, function (error, data) {

        expect(error).to.not.exist;
        expect(data).to.exist;
        expect(data.length).to.be.at.least(2);
        done();
      });
    });

    it('allows mrT1 to get just the parent messages for his team ', function (done) {

      mrT1Client.getNotesForUser(mrT1.id, null, function (error, data) {

        expect(error).to.not.exist;
        expect(data).to.exist;

        for (var i = data.length - 1; i >= 0; i--) {
          expect(data[i].parentmessage).to.not.exist;
        }

        done();
      });
    });

  });

  describe('mrT1 groups', function () {

    it('has a team', function (done) {

      mrT1Client.getUsersTeam(mrT1.id, function (error, team) {
        if (error) {
          return done(error);
        }
        expect(error).to.not.exist;
        expect(team).to.exist;
        expect(team.members).to.exist;
        expect(team.members).to.be.a('array');
        expect(team.id).to.exist;
        done();
      });
    });

    it('has patients', function (done) {

      mrT1Client.getUsersPatients(mrT1.id, function (error, patients) {
        if (error) {
          return done(error);
        }
        expect(error).to.not.exist;
        expect(patients).to.exist;
        expect(patients.members).to.exist;
        expect(patients.members).to.be.a('array');
        expect(patients.id).to.exist;
        done();
      });
    });

    it('has invited', function (done) {

      mrT1Client.getInvitesToTeam(mrT1.id, function (error, invites) {
        if (error) {
          return done(error);
        }
        expect(error).to.not.exist;
        expect(invites).to.exist;
        expect(invites.members).to.exist;
        expect(invites.members).to.be.a('array');
        expect(invites.id).to.exist;
        done();
      });
    });
  });

  describe('careTeamMember groups', function () {

    it('has a team', function (done) {

      careTeamClient.getUsersTeam(careTeamMember.id, function (error, team) {
        if (error) {
          return done(error);
        }
        expect(error).to.not.exist;
        expect(team).to.exist;
        expect(team.members).to.exist;
        expect(team.members).to.be.a('array');
        expect(team.id).to.exist;
        done();
      });
    });

    it('has patients', function (done) {

      careTeamClient.getUsersPatients(careTeamMember.id, function (error, patients) {
        if (error) {
          return done(error);
        }
        expect(error).to.not.exist;
        expect(patients).to.exist;
        expect(patients.members).to.exist;
        expect(patients.members).to.be.a('array');
        expect(patients.id).to.exist;
        done();
      });
    });

    it('has invited', function (done) {

      careTeamClient.getInvitesToTeam(careTeamMember.id, function (error, invites) {
        if (error) {
          return done(error);
        }
        expect(error).to.not.exist;
        expect(invites).to.exist;
        expect(invites.members).to.exist;
        expect(invites.members).to.be.a('array');
        expect(invites.id).to.exist;
        done();
      });
    });
  });

  describe('groups managment for mrT1 ', function () {

    it('allows him to invite another user to join the team', function (done) {

      mrT1Client.inviteToJoinTeam(mrT1.id, careTeamMember.id, function (error, team) {
        if (error) {
          return done(error);
        }
        mrT1Client.getInvitesToTeam(mrT1.id, function (error, invites) {
          if (error) {
            return done(error);
          }
          expect(invites.members).to.include(careTeamMember.id);
          done();
        });
      });
    });

    it('which means the invited user is added to his team when they accept an invite', function (done) {

      mrT1Client.acceptInviteToJoinTeam(mrT1.id, careTeamMember.id, function (error, team) {
        if (error) {
          return done(error);
        }
        mrT1Client.getUsersTeam(mrT1.id, function (error, team) {
          if (error) {
            return done(error);
          }
          expect(team.members).to.include(careTeamMember.id);
          done();
        });
      });
    });

    it('is added to careTeamMember patients list', function (done) {

      careTeamClient.addToPatients(mrT1.id, careTeamMember.id, function (error, team) {
        if (error) {
          return done(error);
        }
        careTeamClient.getUsersPatients(careTeamMember.id, function (error, patients) {
          if (error) {
            return done(error);
          }
          expect(patients.members).to.include(mrT1.id);
          done();
        });
      });
    });

  });

  describe('careTeamMember', function () {

    var careTeamMembersPatients;
    var mrT1sTeam;
    var notesForThePatientMrT1;

    it('can get the patients and mrT1 is included', function (done) {
      careTeamClient.getUsersPatients(careTeamMember.id, function (error, patients) {
        expect(patients.members).to.exist;
        expect(patients.members).to.include(mrT1.id);
        careTeamMembersPatients = patients;
        done();
      });
    });

    it('mrT1 gets his team and careTeamMember is included', function (done) {
      mrT1Client.getUsersTeam(mrT1.id, function (error, team) {
        expect(team.members).to.exist;
        expect(team.members).to.include(careTeamMember.id);
        mrT1sTeam = team;
        done();
      });
    });

    it('can get the team for mrT1 and is included in the members', function (done) {
      careTeamClient.getUsersTeam(mrT1.id, function (error, patientsTeam) {
        expect(patientsTeam.members).to.include(careTeamMember.id);
        done();
      });
    });

    it('can get the notes for the team of mrT1', function (done) {
      mrT1Client.getNotesForUser(mrT1.id, null, function (error, patientsNotes) {
        expect(patientsNotes).to.exist;
        expect(patientsNotes).to.have.length.above(0);
        notesForThePatientMrT1 = patientsNotes;
        done();
      });
    });

    it('can see the notes for patient mrT1 are the same as he sees', function (done) {
      careTeamClient.getNotesForUser(mrT1.id, null, function (error, mrT1TeamNotes) {
        expect(mrT1TeamNotes).to.exist;
        expect(mrT1TeamNotes).to.have.length.above(0);
        expect(mrT1TeamNotes).that.deep.equals(notesForThePatientMrT1);
        done();
      });
    });
  });
});