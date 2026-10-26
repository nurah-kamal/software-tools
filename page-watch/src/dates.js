// Today's date in South Africa, as yyyy-mm-dd, whatever the machine's time zone.
export function today(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(now);
}
