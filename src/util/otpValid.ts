export const isOtpExpired = (otpTimestamp: Date): boolean => {
    const currentUtcTime: Date = new Date();

    otpTimestamp.setMinutes(otpTimestamp.getMinutes() - otpTimestamp.getTimezoneOffset());

    const expirationTimeLimit = 120;
    const timeDifferenceInSeconds = Math.floor((currentUtcTime.getTime() - otpTimestamp.getTime()) / 1000);

    const isExpired = timeDifferenceInSeconds > expirationTimeLimit;

    return isExpired;
};
