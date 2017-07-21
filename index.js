'use strict';

const config = require('./config.json');
const fetch = require('node-fetch');

class AssetLoaderScorer {

  constructor(eventTypeName, accountId, queryKey, insertKey) {
    this.eventTypeName = eventTypeName;
    this.baseQueryUrl = 'https://insights-api.newrelic.com/v1/accounts/'+accountId+'/query?nrql=';
    this.queryHeaders = { headers: { 'Accept': 'application/json', 'X-Query-Key': queryKey }};
    this.insertUrl = 'https://insights-collector.newrelic.com/v1/accounts/'+accountId+'/events';
    this.insertHeaders = { method: 'POST', headers: { 'Content-Type': 'application/json',  'X-Insert-Key': insertKey }};
  }

  scoreLatestChecksForMonitors(monitorIds) {
    for (let monitorId of monitorIds) {

      var checkId;
      var monitorName;
      var checkIdNRQL = 'SELECT LATEST(id) FROM SyntheticCheck WHERE monitorId = \''+monitorId+'\'';
      var getCheckIdUrl = this.baseQueryUrl + escape(checkIdNRQL);
      var monitorNameNRQL = 'SELECT uniques(monitorName) FROM SyntheticCheck WHERE monitorId = \''+monitorId+'\'';
      var getMonitorNameUrl = this.baseQueryUrl + escape(monitorNameNRQL);

      fetch(getMonitorNameUrl, this.queryHeaders)
      .then((res) => res.json())
      .then((json) => {
        monitorName = json.results[0].members[0];
        return fetch(getCheckIdUrl, this.queryHeaders);
      })
      .then((res) => res.json())
      .then((json) => {
        checkId = json.results[0].latest;

        let checkResultsNRQL = 'SELECT URL, timestamp, duration, onPageContentLoad, responseCode, id ';
        checkResultsNRQL += 'FROM SyntheticRequest WHERE checkId = \'';
        checkResultsNRQL += checkId+'\' ORDER BY timestamp LIMIT 1000';

        let checkResultsQuery = this.baseQueryUrl + escape(checkResultsNRQL);

        return fetch(checkResultsQuery, this.queryHeaders);
      }).then((res) => res.json())
      .then((json) => {
        let checkResults = json.results[0].events;
        var firstRequestStartTime;
        let data = checkResults.map((check, index) => {

          // Get the first request's timestamp so it can be used to calculate the DOMContentLoaded for all requests
          if (index===0) firstRequestStartTime = check.timestamp;

          let res = { eventType: this.eventTypeName, firstRequestStartTime: firstRequestStartTime };
          res.URL = check.URL;
          res.beginTime = check.timestamp;
          res.finishTime = check.timestamp+check.duration;
          res.onPageContentLoad = check.onPageContentLoad;
          res.DOMContentLoaded = firstRequestStartTime+check.onPageContentLoad;
          res.responseCode = check.responseCode;
          res.id = check.id;
          res.checkId = checkId;
          res.monitorId = monitorId;
          res.monitorName = monitorName;

          // Did request start and end before DOM Complete?
          // Boolean values are not allowed in Insights, so saving as Int value
          // For the purpose of this script, anything equal to the DOM Complete time is considered as happening before
          res.beginBeforeDOMComplete =  +(res.beginTime <= res.DOMContentLoaded);
          res.finishBeforeDOMComplete = +(res.finishTime <= res.DOMContentLoaded);

          // Set a score for whether asset started and ended loading befor or after DOM Complete
          // 0: start and end before DOM Complete
          // 1: start before DOM Complete, but end after DOM Complete
          // 2: start and end after DOM Complete
          // 3: error loading asset
          res.loadingRelativeToDOMCompleteScore = (res.responseCode === 200) ? (parseInt('' + (+!res.beginBeforeDOMComplete) + (+!res.finishBeforeDOMComplete), 2)) : 4;

          // Removing '2: start after DOM Complete, but end before DOM Complete'
          // If loadingRelativeToDOMCompleteScore > 2, subtract by 1 to account for the fact that we removed '2'
          if (res.loadingRelativeToDOMCompleteScore > 2) res.loadingRelativeToDOMCompleteScore--;

          // Adding a string representation of loadingRelativeToDOMCompleteScore to allow faceting
          res.loadingRelativeToDOMCompleteScoreString = [
            'Start and End <= DOM Complete',
            'Start <= DOM Complete, End > DOM Complete',
            'Start and End > DOM Complete',
            'Error!'
          ][res.loadingRelativeToDOMCompleteScore];

          return res;
        });
        return data;
      })
      .then((customEventData) => {
        console.log('CUSTOM EVENT DATA', customEventData);
        this.insertHeaders.body = JSON.stringify(customEventData);
        return fetch(this.insertUrl, this.insertHeaders);
      }).then((res) => res.json())
      .then((json) => {
        console.log('INSERT RESPONSE', json);
      });
    }
  }

}

const assetLoaderScorer = new AssetLoaderScorer(config.eventTypeName, config.accountId, config.queryKey, config.insertKey);
assetLoaderScorer.scoreLatestChecksForMonitors(config.monitorIds);
