import moment from 'moment';

/**
 * Ensures a moment object is offset to IST (+05:30)
 * We parse as UTC then add offset to force IST regardless of device timezone.
 */
const toIST = (dateInput, formatStr) => {
  if (!dateInput) return moment().utcOffset('+05:30');
  
  if (typeof dateInput === 'string' && formatStr) {
    // If it's a specific format string (like 'HH:mm')
    return moment(dateInput, formatStr).utcOffset('+05:30', true); 
  }
  
  // Normal date parse, force it to be interpreted in IST
  // If it's an ISO string it contains timezone info, so we just convert it to IST.
  return moment(dateInput).utcOffset('+05:30');
};

/**
 * Format date to Standard Indian Format: DD/MM/YYYY
 */
export const formatISTDate = (date) => {
  if (!date) return 'N/A';
  return toIST(date).format('DD/MM/YYYY');
};

/**
 * Format date to spelled out Indian Format: DD MMM YYYY (e.g. 01 Jul 2026)
 */
export const formatISTDateSpelled = (date) => {
  if (!date) return 'N/A';
  return toIST(date).format('DD MMM YYYY');
};

/**
 * Format date to full format: ddd, MMM DD YYYY (e.g. Wed, Jul 01 2026)
 */
export const formatISTDateFull = (date) => {
  if (!date) return 'N/A';
  return toIST(date).format('ddd, MMM DD YYYY');
};

/**
 * Format time from HH:mm to 12-hour AM/PM (e.g. 10:00 AM)
 */
export const formatISTTime = (timeStr) => {
  if (!timeStr) return '';
  return toIST(timeStr, 'HH:mm').format('hh:mm A');
};

/**
 * Format full date and time: DD/MM/YYYY hh:mm A
 */
export const formatISTDateTime = (date) => {
  if (!date) return 'N/A';
  return toIST(date).format('DD/MM/YYYY hh:mm A');
};
