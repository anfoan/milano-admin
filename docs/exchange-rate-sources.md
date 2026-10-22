# Exchange-rate source

The admin currency system uses ExchangeRate-API's open access endpoint:
`https://open.er-api.com/v6/latest/YER`

The provider documentation says the open endpoint requires no API key, updates once per day, supports caching, and requires attribution: https://www.exchangerate-api.com/docs/free

The app stores rates as target-currency units per 1 YER in `settings/general.exchangeRates`, keeps Firestore amounts unchanged in YER, and refreshes the cached rates at most once per 24 hours when the admin app is opened. The app also stores `exchangeRateUpdatedAt` and `exchangeRateSource`.

Alternative researched source: Frankfurter provides a no-key daily API backed by central banks, but the implementation uses ExchangeRate-API because its documented open endpoint explicitly supports YER as a base-currency request and the current endpoint returned YER, SAR, and USD rates.
Source: https://frankfurter.dev/
