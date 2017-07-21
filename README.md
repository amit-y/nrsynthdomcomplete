# New Relic Synthetics DOM Complete scripts

This script takes requests from a [Synthetics](https://newrelic.com/synthetics) check, calculates additional parameters to identify if the requests started and completed before DOM Complete, and saves it into [Insights](https://newrelic.com/insights) as a custom event.

## Configuration

Configuration is managed within the config.json file.

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| **eventTypeName**  | String  | The name of the custom event under which to store the data in Insights. Defaults to *LoadingRelativeToDOMComplete* |
| **accountId**  | String  | [New Relic Account ID](https://docs.newrelic.com/docs/accounts-partnerships/accounts/account-setup/account-id) |
| **queryKey** | String | [Insights API Query Key](https://docs.newrelic.com/docs/insights/insights-api/get-data/query-insights-event-data-api#register) |
| **insertKey** | String | [Insights API Insert Key](https://docs.newrelic.com/docs/insights/insights-data-sources/custom-data/insert-custom-events-insights-api#register) |
| **monitorIds** | Array | An array of string values. |
