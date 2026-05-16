import { SendEmailTemplet, SendCalendarInvite } from "./nodemailer";
const ical = require('ical-toolkit');

export const sendPasswordByEmail = async (email: string, password: any): Promise<boolean> => {
    try {
        const html = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; color: #333; line-height: 1.6; }
                .wrapper { width: 100%; background-color: #f5f5f5; padding: 20px 0; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center; }
                .logo { max-width: 140px; height: auto; margin-bottom: 15px; display: inline-block; }
                .header-title { color: #ffffff; font-size: 24px; font-weight: 700; margin: 10px 0 0 0; }
                .content { padding: 30px; }
                .password-box { background-color: #f0f4ff; border-left: 4px solid #667eea; padding: 20px; border-radius: 4px; margin: 20px 0; text-align: center; }
                .password-label { font-size: 13px; color: #666; font-weight: 600; margin-bottom: 10px; }
                .password-value { font-size: 24px; font-weight: 700; color: #667eea; font-family: 'Courier New', monospace; letter-spacing: 2px; }
                .message { font-size: 14px; color: #555; line-height: 1.8; margin: 20px 0; }
                .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #e0e0e0; }
                .footer-text { margin: 5px 0; }
                .footer-link { color: #667eea; text-decoration: none; }
                @media (max-width: 600px) { .container { border-radius: 0; } .content { padding: 20px; } .header-title { font-size: 20px; } }
            </style>
        </head>
        <body>
            <div class="wrapper">
                <div class="container">
                    <div class="header">
                        <img class="logo" src="https://lockermedia.s3.amazonaws.com/undefined/1770038121918_locker.jpeg" alt="Locker Logo">
                        <div class="header-title">🎉 Welcome to Locker</div>
                    </div>
                    <div class="content">
                        <div class="message">
                            <p>Congratulations! Your account has been successfully created.</p>
                            <p style="margin-top: 15px;">Your login credentials are ready. You can now access the Locker platform using the password below:</p>
                        </div>
                        <div class="password-box">
                            <div class="password-label">Your Temporary Password</div>
                            <div class="password-value">${password}</div>
                        </div>
                        <div class="message">
                            <p style="color: #e74c3c; font-weight: 600;">⚠️ Important:</p>
                            <p>Please keep this password secure and change it after your first login for security purposes.</p>
                        </div>
                    </div>
                    <div class="footer">
                        <div class="footer-text">This is an automated message from the Locker system.</div>
                        <div class="footer-text" style="margin-top: 10px;">© 2026 Locker. All rights reserved.</div>
                    </div>
                </div>
            </div>
        </body>
        </html>`;
        const responce = await SendEmailTemplet(email, "Welcome to Locker", null, html)
        return true
    } catch (error) {
        console.log(error)
        return true
    }
}

export const resetPasswordByEmail = async (email: string, resetLink: string): Promise<boolean> => {
    try {
        const html = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; color: #333; line-height: 1.6; }
                .wrapper { width: 100%; background-color: #f5f5f5; padding: 20px 0; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
                .header { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); padding: 30px 20px; text-align: center; }
                .logo { max-width: 140px; height: auto; margin-bottom: 15px; display: inline-block; }
                .header-title { color: #ffffff; font-size: 24px; font-weight: 700; margin: 10px 0 0 0; }
                .content { padding: 30px; }
                .message { font-size: 14px; color: #555; line-height: 1.8; margin: 15px 0; }
                .action-button { display: inline-block; background-color: #667eea; color: #ffffff !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px; }
                .action-button:hover { background-color: #764ba2; }
                .warning-box { background-color: #fef5e7; border-left: 4px solid #f39c12; padding: 15px; border-radius: 4px; margin: 20px 0; font-size: 13px; color: #666; }
                .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #e0e0e0; }
                .footer-text { margin: 5px 0; }
                @media (max-width: 600px) { .container { border-radius: 0; } .content { padding: 20px; } .header-title { font-size: 20px; } }
            </style>
        </head>
        <body>
            <div class="wrapper">
                <div class="container">
                    <div class="header">
                        <img class="logo" src="https://lockermedia.s3.amazonaws.com/undefined/1770038121918_locker.jpeg" alt="Locker Logo">
                        <div class="header-title">🔐 Reset Your Password</div>
                    </div>
                    <div class="content">
                        <div class="message">
                            <p>We received a request to reset your password. Click the button below to proceed with resetting your password.</p>
                        </div>
                        <div style="text-align: center;">
                            <a href="${resetLink}" class="action-button">Reset Password</a>
                        </div>
                        <div class="warning-box">
                            <strong>⏱️ Link Expiration:</strong> This reset link will expire in 24 hours for security purposes.
                        </div>
                        <div class="message" style="margin-top: 20px;">
                            <p><strong>Didn't request this?</strong> If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
                        </div>
                    </div>
                    <div class="footer">
                        <div class="footer-text">This is an automated message from the Locker system.</div>
                        <div class="footer-text" style="margin-top: 10px;">© 2026 Locker. All rights reserved.</div>
                    </div>
                </div>
            </div>
        </body>
        </html>`;
        const response = await SendEmailTemplet(email, "Reset Your Locker Password", null, html);
        return true;
    } catch (error) {
        console.log("resetPasswordByEmail error:", error);
        return false;
    }
};

const generateOTP = (): string => {
    const digits = '0123456789';
    let OTP = '';
    for (let i = 0; i < 6; i++) {
        OTP += digits[Math.floor(Math.random() * 10)];
    }
    return OTP;
};

export const sendOtpByEmail = async (email: string): Promise<any> => {
    const otp = generateOTP();

    const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; color: #333; line-height: 1.6; }
            .wrapper { width: 100%; background-color: #f5f5f5; padding: 20px 0; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
            .header { background: linear-gradient(135deg, #27ae60 0%, #229954 100%); padding: 30px 20px; text-align: center; }
            .logo { max-width: 140px; height: auto; margin-bottom: 15px; display: inline-block; }
            .header-title { color: #ffffff; font-size: 24px; font-weight: 700; margin: 10px 0 0 0; }
            .content { padding: 30px; }
            .message { font-size: 14px; color: #555; line-height: 1.8; margin: 15px 0; }
           .otp-box { background-color: #f0f4ff; border-left: 4px solid #38de7d; padding: 20px; border-radius: 4px; margin: 20px 0; text-align: center; }
            .otp-label { color: rgba(54, 188, 92, 0.9); font-size: 13px; font-weight: 600; margin-bottom: 10px; }
            .otp-value { font-size: 42px; font-weight: 700; color: #38de7d; font-family: 'Courier New', monospace; letter-spacing: 3px; }
            .warning-box { background-color: #fef5e7; border-left: 4px solid #f39c12; padding: 15px; border-radius: 4px; margin: 15px 0; font-size: 13px; color: #666; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #e0e0e0; }
            .footer-text { margin: 5px 0; }
            @media (max-width: 600px) { .container { border-radius: 0; } .content { padding: 20px; } .header-title { font-size: 20px; } .otp-value { font-size: 36px; } }
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="container">
                <div class="header">
                    <img class="logo" src="https://lockermedia.s3.amazonaws.com/undefined/1770038121918_locker.jpeg" alt="Locker Logo">
                    <div class="header-title">🔐 Your One-Time Password</div>
                </div>
                <div class="content">
                    <div class="message">
                        <p>A request has been made to verify your identity for your Locker account. Use the code below to proceed:</p>
                    </div>
                    <div class="otp-box">
                        <div class="otp-label">Enter this code:</div>
                        <div class="otp-value">${otp}</div>
                    </div>
                    <div class="warning-box">
                        <strong>⏱️ Valid for 10 minutes:</strong> This code will expire in 10 minutes for security. Do not share this code with anyone.
                    </div>
                    <div class="message" style="margin-top: 20px;">
                        <p><strong>Didn't request this?</strong> If you did not request this code, please ignore this email or contact support immediately.</p>
                    </div>
                </div>
                <div class="footer">
                    <div class="footer-text">This is an automated message from the Locker system.</div>
                    <div class="footer-text" style="margin-top: 10px;">© 2026 Locker. All rights reserved.</div>
                </div>
            </div>
        </div>
    </body>
    </html> `;

    const response = await SendEmailTemplet(email, "Locker - One-Time Password for Your Account", null, html);

    return otp;
};

export const sendUserEmail = async (email: string, data: any): Promise<any> => {
    const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; color: #333; line-height: 1.6; }
            .wrapper { width: 100%; background-color: #f5f5f5; padding: 20px 0; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center; }
            .logo { max-width: 140px; height: auto; margin-bottom: 15px; display: inline-block; }
            .header-title { color: #ffffff; font-size: 24px; font-weight: 700; margin: 10px 0 0 0; }
            .content { padding: 30px; }
            .subject-box { background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; border-radius: 4px; margin: 20px 0; }
            .subject-title { font-size: 16px; font-weight: 700; color: #2c3e50; margin-bottom: 8px; }
            .message-content { font-size: 14px; color: #555; line-height: 1.8; margin: 20px 0; white-space: pre-wrap; word-break: break-word; }
            .divider { border: none; border-top: 1px solid #e0e0e0; margin: 20px 0; }
            .action-button { display: inline-block; background-color: #667eea; color: #ffffff !important; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 15px; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #e0e0e0; }
            .footer-text { margin: 5px 0; }
            .footer-link { color: #667eea; text-decoration: none; }
            @media (max-width: 600px) { .container { border-radius: 0; } .content { padding: 20px; } .header-title { font-size: 20px; } }
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="container">
                <div class="header">
                    <img class="logo" src="https://lockermedia.s3.amazonaws.com/undefined/1770038121918_locker.jpeg" alt="Locker Logo">
                    <div class="header-title">📧 Message for You</div>
                </div>
                <div class="content">
                    <div class="subject-box">
                        <div class="subject-title">${data.subject || 'New Message'}</div>
                    </div>
                    <div class="message-content">${data.message}</div>
                    <hr class="divider">
                    <div style="text-align: center;">
                        <a href="${process.env.FRONTEND}" class="action-button">View in Locker</a>
                    </div>
                </div>
                <div class="footer">
                    <div class="footer-text">From: <strong>${data.adminName || 'Locker Administrator'}</strong></div>
                    <div class="footer-text" style="margin-top: 10px; font-size: 11px;">This is an automated message from the Locker system. Please do not reply to this email.</div>
                    <div class="footer-text" style="margin-top: 8px; color: #999;">© 2026 Locker. All rights reserved.</div>
                </div>
            </div>
        </div>
    </body>
    </html>`;

    const response = await SendEmailTemplet(email, data.subject, null, html);
    return true;
};

export const sendAdminAssignmentEmail = async (email: string, data: { type: "organisation" | "centre"; organisationName?: string; centreName?: string; assignedByName?: string; }): Promise<boolean> => {
    try {
        const loginUrl = process.env.FRONTEND || "";
        const title = data.type === "organisation" ? "You've been assigned as an Organisation Admin" : "You've been assigned as a Centre Admin";
        const icon = data.type === "organisation" ? "🏢" : "🏛️";
        const assignedByLine = data.assignedByName ? `<div class="meta-row"><span class="meta-label">Assigned by:</span> ${data.assignedByName}</div>` : "";
        const scopeLabel = data.type === "organisation" ? "Organisation" : "Centre";
        const scopeValue = data.type === "organisation" ? data.organisationName : data.centreName;

        const html = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; background-color: #f5f8fb; color: #33475b; }
                .wrapper { width: 100%; padding: 30px 0; background-color: #f5f8fb; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 18px 60px rgba(29, 43, 64, 0.12); }
                .header { background: linear-gradient(135deg, #16a085 0%, #1abc9c 100%); padding: 34px 24px; text-align: center; }
                .header-icon { font-size: 38px; display: block; margin-bottom: 14px; }
                .header-title { color: #ffffff; font-size: 24px; font-weight: 700; line-height: 1.2; }
                .content { padding: 32px 28px 24px; }
                .intro { font-size: 16px; color: #49535f; line-height: 1.8; margin-bottom: 22px; }
                .meta-info { background-color: #effaf6; border-left: 4px solid #16a085; border-radius: 10px; padding: 18px 20px; margin: 20px 0; }
                .meta-row { font-size: 14px; color: #2f4858; margin-bottom: 10px; }
                .meta-label { font-weight: 700; color: #1c363f; }
                .scope-box { background: linear-gradient(135deg, #16a085 0%, #1abc9c 100%); color: #ffffff; padding: 22px 18px; border-radius: 12px; text-align: center; margin: 24px 0; }
                .scope-label { font-size: 13px; opacity: 0.88; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 8px; display: block; }
                .scope-value { font-size: 20px; font-weight: 700; }
                .action-button { display: inline-block; background-color: #16a085; color: #ffffff !important; text-decoration: none; border-radius: 10px; padding: 14px 28px; font-size: 15px; font-weight: 700; margin-top: 16px; }
                .footer { background-color: #f3f7f9; padding: 18px 24px; text-align: center; font-size: 13px; color: #7a8692; border-top: 1px solid #e8eff2; }
                .footer a { color: #16a085; text-decoration: none; }
                .logo { max-width: 140px; height: auto; display: inline-block; }
                @media (max-width: 620px) { .container { border-radius: 0; } .content { padding: 24px 18px 20px; } .header { padding: 28px 20px; } }
            </style>
        </head>
        <body>
            <div class="wrapper">
                <div class="container">
                    <div class="header">
                        <div class="header-icon"> <img class="logo" src="https://lockermedia.s3.amazonaws.com/undefined/1770038121918_locker.jpeg" alt="Locker Logo"></div>
                        <div class="header-title">${title}</div>
                    </div>
                    <div class="content">
                        <div class="intro">Congratulations! You have been granted admin access to ${scopeLabel.toLowerCase()} level permissions within Locker.</div>
                        <div class="meta-info">
                            ${assignedByLine}
                            ${scopeValue ? `<div class="meta-row"><span class="meta-label">${scopeLabel}:</span> ${scopeValue}</div>` : ""}
                        </div>
                        <div class="scope-box">
                            <span class="scope-label">Assigned Scope</span>
                            <div class="scope-value">${scopeValue || `New ${scopeLabel}`}</div>
                        </div>
                        ${loginUrl ? `<div style="text-align:center;"><a href="${loginUrl}" class="action-button">Login to Locker</a></div>` : ""}
                        <p class="intro">If you have any questions about your access or need assistance, please reach out to your administrator.</p>
                    </div>
                    <div class="footer">This message was sent automatically by Locker. Please do not reply to this email.</div>
                    <div class="footer-text" style="margin-top: 8px; color: #999;">© 2026 Locker. All rights reserved.</div>
                </div>
            </div>
        </body>
        </html>`;

        await SendEmailTemplet(email, `Locker - ${title}`, null, html);
        return true;
    } catch (error) {
        console.log("sendAdminAssignmentEmail error:", error);
        return false;
    }
};

export const sendSessionInviteEmail = async (
    learnerEmail: string,
    sessionData: {
        title: string;
        description: string;
        trainerName: string;
        startDate: string;
        endDate: string;
        location: string;
        duration: number;
    }
): Promise<boolean> => {
    try {
        // Format dates for display
        const startDateTime = new Date(sessionData.startDate);
        const endDateTime = new Date(sessionData.endDate);

        const formatDate = (date: Date) => {
            return date.toLocaleDateString('en-GB', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        };

        const formatTime = (date: Date) => {
            return date.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        };

        // Create calendar invitation using ical-toolkit
        const calendarEvent = generateICalEvent(sessionData, learnerEmail);

        // Calendar invitation email content
        const emailContent = `You have been invited to a training session.

        Session Details:
        - Title: ${sessionData.title}
        - Trainer: ${sessionData.trainerName}
        - Date: ${formatDate(startDateTime)}
        - Time: ${formatTime(startDateTime)} - ${formatTime(endDateTime)}
        - Duration: ${sessionData.duration} minutes
        - Location: ${sessionData.location || 'To be confirmed'}
            
        ${sessionData.description ? `Description: ${sessionData.description}` : ''}
            
        If you have any questions, please contact your trainer.`;

        // Send as calendar invitation
        const response = await SendCalendarInvite(
            learnerEmail,
            `Training Session Invitation: ${sessionData.title}`,
            emailContent,
            calendarEvent
        );

        return true;
    } catch (error) {
        console.log('Error sending session invite email:', error);
        return false;
    }
};

// Helper function to generate calendar invitation using ical-toolkit
const generateICalEvent = (sessionData: {
    title: string;
    description: string;
    trainerName: string;
    startDate: string;
    endDate: string;
    location: string;
}, attendeeEmail: string) => {
    const startDate = new Date(sessionData.startDate);
    const endDate = new Date(sessionData.endDate);

    // Create calendar using ical-toolkit
    const builder = ical.createIcsFileBuilder();

    builder.spacers = true;
    builder.NEWLINE_CHAR = '\r\n';
    builder.throwError = false;
    builder.ignoreTZIDMismatch = true;

    // Add calendar properties for invitation
    builder.calname = 'Locker Training Sessions';
    builder.timezone = 'UTC';
    builder.tzid = 'UTC';
    builder.method = 'REQUEST';
    builder.additionalTags = {
        'PRODID': '-//Locker//Training Session//EN',
        'VERSION': '2.0',
        'CALSCALE': 'GREGORIAN',
        'METHOD': 'REQUEST'
    };

    // Add the event with attendee
    builder.events.push({
        start: startDate,
        end: endDate,
        transp: 'OPAQUE',
        summary: sessionData.title,
        alarms: [15], // 15 minutes before
        description: `Training session with ${sessionData.trainerName}\n\n${sessionData.description || 'No additional description provided.'}`,
        location: sessionData.location || 'To be confirmed',
        organizer: {
            name: sessionData.trainerName,
            email: 'noreply@locker.com'
        },
        attendees: [{
            name: attendeeEmail.split('@')[0],
            email: attendeeEmail,
            rsvp: true,
            partstat: 'NEEDS-ACTION',
            role: 'REQ-PARTICIPANT'
        }],
        uid: `session-${Date.now()}@locker.com`,
        sequence: 0,
        //status: 'CONFIRMED',
        method: 'REQUEST'
    });

    return builder.toString();
};

export const generateSurveyAllocationEmailHTML = (surveyName: string, surveyLink: string, userName?: string): string => {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; background-color: #eef6fc; color: #2c3e50; }
            .wrapper { width: 100%; padding: 28px 0; background-color: #eef6fc; }
            .container { max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08); }
            .header { background: linear-gradient(135deg, #2980b9 0%, #3498db 100%); padding: 36px 24px; text-align: center; }
            .header-icon { font-size: 34px; margin-bottom: 12px; }
            .header-title { color: #ffffff; font-size: 24px; font-weight: 700; line-height: 1.2; }
            .content { padding: 32px 28px; }
            .greeting { color: #33475b; font-size: 16px; margin-bottom: 20px; line-height: 1.8; }
            .survey-box { background: linear-gradient(135deg, #2980b9 0%, #3498db 100%); border-radius: 12px; color: #ffffff; padding: 24px 20px; text-align: center; margin: 24px 0; }
            .survey-label { font-size: 13px; text-transform: uppercase; opacity: 0.88; letter-spacing: 0.08em; margin-bottom: 8px; display: block; }
            .survey-name-display { font-size: 22px; font-weight: 700; line-height: 1.3; }
            .description { font-size: 15px; color: #546e8e; line-height: 1.8; margin-bottom: 28px; }
            .action-button { display: inline-block; background-color: #2980b9; color: #ffffff !important; text-decoration: none; padding: 14px 30px; border-radius: 10px; font-size: 15px; font-weight: 700; }
            .info-box { background-color: #eff5fb; border-left: 4px solid #2980b9; border-radius: 10px; padding: 18px 20px; margin-top: 26px; color: #3b5978; font-size: 14px; line-height: 1.7; }
            .footer { padding: 24px 28px 30px; font-size: 13px; color: #6b7f94; line-height: 1.6; }
            .footer a { color: #2980b9; text-decoration: none; }
             .logo { max-width: 140px; height: auto; display: inline-block; }
            @media (max-width: 620px) { .container { border-radius: 0; } .content { padding: 24px 18px; } .header { padding: 28px 18px; } }
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="container">
                <div class="header">
                     <img class="logo" src="https://lockermedia.s3.amazonaws.com/undefined/1770038121918_locker.jpeg" alt="Locker Logo">
                    <div class="header-icon"></div>
                    <div class="header-title">📋 Survey Assigned</div>
                </div>
                <div class="content">
                    <div class="greeting">${userName ? `Hello ${userName},` : 'Hello,'} You have a new survey assignment in Locker. Please review the details below and complete the survey at your earliest convenience.</div>
                    <div class="survey-box">
                        <span class="survey-label">Assigned Survey</span>
                        <div class="survey-name-display">${surveyName}</div>
                    </div>
                    <div class="description">Your responses will be saved automatically, so you can return to the survey at any time without losing progress.</div>
                    <div style="text-align: center; margin-top: 20px;">
                        <a href="${surveyLink}" class="action-button">Access Survey Now</a>
                    </div>
                    <div class="info-box">Note: The survey link is unique to this assignment. If you need help, please contact your administrator or log in to the Locker system.</div>
                </div>
                <div class="footer">
                    <p>This is an automated message from the Locker system. Please do not reply to this email.</p>
                   <div class="footer-text" style="margin-top: 8px; color: #999;">© 2026 Locker. All rights reserved.</div>
                </div>
            </div>
        </div>
    </body>
    </html>`;
};

/**
 * Send broadcast message email notification
 * @param email Recipient email address
 * @param data Broadcast data containing title and description
 * @returns Promise<boolean>
 */
export const sendBroadcastEmail = async (
    email: string,
    data: {
        title: string;
        description: string;
        senderName?: string;
        sentAt?: string;
    }
): Promise<boolean> => {
    try {
        const loginUrl = process.env.FRONTEND || "";
        const sentDate = data.sentAt ? new Date(data.sentAt).toLocaleDateString('en-GB', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) : new Date().toLocaleDateString('en-GB', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const html = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                body {
                    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                    background-color: #f5f5f5;
                    color: #333;
                    line-height: 1.6;
                }

                .wrapper {
                    width: 100%;
                    background-color: #f5f5f5;
                    padding: 20px 0;
                }

                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: #ffffff;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                }

                .header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 30px 20px;
                    text-align: center;
                }

                .logo {
                    max-width: 140px;
                    height: auto;
                    margin-bottom: 15px;
                    display: inline-block;
                }

                .header-title {
                    color: #ffffff;
                    font-size: 24px;
                    font-weight: 700;
                    margin: 10px 0 0 0;
                }

                .content {
                    padding: 30px;
                }

                .broadcast-title {
                    font-size: 20px;
                    font-weight: 700;
                    color: #2c3e50;
                    margin-bottom: 15px;
                    border-bottom: 3px solid #667eea;
                    padding-bottom: 10px;
                }

                .broadcast-description {
                    font-size: 14px;
                    color: #555;
                    line-height: 1.8;
                    margin-bottom: 20px;
                    white-space: pre-wrap;
                    word-break: break-word;
                }

                .meta-info {
                    background-color: #f8f9fa;
                    border-left: 4px solid #667eea;
                    padding: 12px 15px;
                    margin: 20px 0;
                    border-radius: 4px;
                    font-size: 13px;
                    color: #666;
                }

                .meta-row {
                    margin: 5px 0;
                }

                .meta-label {
                    font-weight: 600;
                    color: #2c3e50;
                }

                .action-button {
                    display: inline-block;
                    background-color: #667eea;
                    color: #ffffff !important;
                    padding: 12px 28px;
                    text-decoration: none;
                    border-radius: 6px;
                    font-weight: 600;
                    margin-top: 15px;
                    transition: background-color 0.3s ease;
                }

                .action-button:hover {
                    background-color: #764ba2;
                }

                .divider {
                    border: none;
                    border-top: 1px solid #e0e0e0;
                    margin: 25px 0;
                }

                .footer {
                    background-color: #f8f9fa;
                    padding: 20px;
                    text-align: center;
                    font-size: 12px;
                    color: #888;
                    border-top: 1px solid #e0e0e0;
                }

                .footer-text {
                    margin: 5px 0;
                }

                .footer-link {
                    color: #667eea;
                    text-decoration: none;
                }

                .footer-link:hover {
                    text-decoration: underline;
                }

                @media (max-width: 600px) {
                    .container {
                        border-radius: 0;
                    }

                    .content {
                        padding: 20px;
                    }

                    .broadcast-title {
                        font-size: 18px;
                    }

                    .header-title {
                        font-size: 20px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="wrapper">
                <div class="container">
                    <!-- Header -->
                    <div class="header">
                        <img class="logo" src="https://lockermedia.s3.amazonaws.com/undefined/1770038121918_locker.jpeg" alt="Locker Logo">
                        <div class="header-title">📢 New Broadcast Message</div>
                    </div>

                    <!-- Main Content -->
                    <div class="content">
                        <div class="broadcast-title">${data.title}</div>

                        <div class="broadcast-description">${data.description}</div>

                        <!-- Meta Information -->
                        <div class="meta-info">
                            ${data.senderName ? `<div class="meta-row"><span class="meta-label">Sent by:</span> ${data.senderName}</div>` : ''}
                            <div class="meta-row"><span class="meta-label">Date & Time:</span> ${sentDate}</div>
                        </div>

                        <hr class="divider">

                        <!-- Call to Action -->
                        ${loginUrl ? `<p style="text-align: center;">
                            <a href="${loginUrl}" class="action-button">View in Locker</a>
                        </p>` : ''}

                        <p style="margin-top: 20px; font-size: 13px; color: #666;">
                            You have received this broadcast message as part of your organization's communications. 
                            Please log in to your Locker account to view more details or to respond if needed.
                        </p>
                    </div>

                    <!-- Footer -->
                    <div class="footer">
                        <div class="footer-text">
                            This is an automated message from the Locker system. Please do not reply to this email.
                        </div>
                        <div class="footer-text" style="margin-top: 8px; color: #999;">
                            © 2026 Locker. All rights reserved.
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>`;

        const response = await SendEmailTemplet(email, `Locker Broadcast: ${data.title}`, null, html);
        return true;
    } catch (error) {
        console.log('Error sending broadcast email:', error);
        return false;
    }
};