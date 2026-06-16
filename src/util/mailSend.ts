import { SendEmailTemplet, SendCalendarInvite } from "./nodemailer";
const ical = require('ical-toolkit');

export const sendPasswordByEmail = async (email: string, password: any): Promise<boolean> => {
    try {
        const html = `<!DOCTYPE html>
        <html lang="en">
        <head>
        <meta charset="UTF-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Locker</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f5f5f5;">
        
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f5f5f5;">
        <tr>
        <td align="center" style="padding:20px 10px;">
        
        
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0">
        <tr>
        <td>
        
        
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:#ffffff;">
        
        
        <tr>
        <td align="center" bgcolor="#667eea" style="padding:30px 20px;">
        <img
        src="https://lockermedia.s3.amazonaws.com/undefined/1770038121918_locker.jpeg"
        alt="Locker Logo"
        width="140"
        border="0"
        style="display:block;width:140px;max-width:140px;height:auto;"
        >
        
        <div style="font-family:Arial, Helvetica, sans-serif;font-size:24px;line-height:32px;font-weight:bold;color:#ffffff;padding-top:15px;">
        🎉 Welcome to Locker
        </div>
        </td>
        </tr>
        
        <!-- Content -->
        <tr>
        <td style="padding:30px;font-family:Arial, Helvetica, sans-serif;color:#555555;font-size:14px;line-height:24px;">
        
        <p style="margin:0 0 15px 0;">
        Congratulations! Your account has been successfully created.
        </p>
        
        <p style="margin:0 0 20px 0;">
        Your login credentials are ready. You can now access the Locker platform using the password below:
        </p>
        
        <!-- Password Box -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f4ff;margin:20px 0;">
        <tr>
        <td width="4" bgcolor="#667eea" style="font-size:0;line-height:0;">&nbsp;</td>
        <td align="center" style="padding:20px;">
        
        <div style="font-family:Arial, Helvetica, sans-serif;font-size:13px;font-weight:bold;color:#666666;margin-bottom:10px;">
        Your Temporary Password
        </div>
        
        <div style="font-family:'Courier New', Courier, monospace;font-size:24px;font-weight:bold;color:#667eea;letter-spacing:2px;">
        ${password}
        </div>
        
        </td>
        </tr>
        </table>
        
        <p style="margin:20px 0 10px 0;color:#e74c3c;font-weight:bold;">
        
        </p>
        
        <p style="margin:0;">
        Please keep this password secure and change it after your first login for security purposes.
        </p>
        
        </td>
        </tr>
        
        <!-- Footer -->
        <tr>
        <td style="background-color:#f8f9fa;padding:20px;border-top:1px solid #e0e0e0;text-align:center;font-family:Arial, Helvetica, sans-serif;font-size:12px;line-height:20px;color:#888888;">
        <div>
        This is an automated message from the Locker system.
        </div>
        
        <div style="padding-top:10px;">
        © 2026 Locker. All rights reserved.
        </div>
        </td>
        </tr>
        
        </table>
        
        <!--[if mso]>
        </td>
        </tr>
        </table>
        <![endif]-->
        
        </td>
        </tr>
        </table>
        
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
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f5f5f5;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f5;">
        <tr>
        <td align="center" style="padding:20px 10px;">
        
        <!--[if mso]>
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0">
        <tr>
        <td>
        <![endif]-->
        
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;">
        
        
        <!-- Header -->
        <tr>
        <td align="center" bgcolor="#e74c3c" style="padding:30px 20px;">
        <img
        src="https://lockermedia.s3.amazonaws.com/undefined/1770038121918_locker.jpeg"
        alt="Locker Logo"
        width="140"
        border="0"
        style="display:block;width:140px;max-width:140px;height:auto;"
        >
        
        <div style="font-family:Arial, Helvetica, sans-serif;font-size:24px;line-height:32px;font-weight:bold;color:#ffffff;padding-top:15px;">
        🔐 Reset Your Password
        </div>
        </td>
        </tr>
        
        <!-- Content -->
        <tr>
        <td style="padding:30px;font-family:Arial, Helvetica, sans-serif;font-size:14px;line-height:24px;color:#555555;">
        
        <p style="margin:0 0 20px 0;">
        We received a request to reset your password. Click the button below to proceed with resetting your password.
        </p>
        
        <!-- Button -->
        <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:20px auto;">
        <tr>
        <td bgcolor="#667eea" align="center" style="padding:12px 30px;">
        
        <!--[if mso]>
        <a href="${resetLink}" style="color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">
        Reset Password
        </a>
        <![endif]-->
        
        <!--[if !mso]><!-->
        <a
        href="${resetLink}"
        style="font-family:Arial, Helvetica, sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;display:inline-block;"
        >
        Reset Password
        </a>
        <!--<![endif]-->
        
        </td>
        </tr>
        </table>
        
        <!-- Warning Box -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fef5e7;margin:20px 0;">
        <tr>
        <td width="4" bgcolor="#f39c12" style="font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:15px;font-family:Arial, Helvetica, sans-serif;font-size:13px;line-height:22px;color:#666666;">
        <strong>⏱️ Link Expiration:</strong>
        This reset link will expire in 24 hours for security purposes.
        </td>
        </tr>
        </table>
        
        <p style="margin:20px 0 0 0;">
        <strong>Didn't request this?</strong>
        If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
        </p>
        
        </td>
        </tr>
        
        <!-- Footer -->
        <tr>
        <td style="background-color:#f8f9fa;padding:20px;border-top:1px solid #e0e0e0;text-align:center;font-family:Arial, Helvetica, sans-serif;font-size:12px;line-height:20px;color:#888888;">
        <div>
        This is an automated message from the Locker system.
        </div>
        
        <div style="padding-top:10px;">
        © 2026 Locker. All rights reserved.
        </div>
        </td>
        </tr>
        
        </table>
        
        <!--[if mso]>
        </td>
        </tr>
        </table>
        <![endif]-->
        
        </td>
        </tr>
        </table>
        
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
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your One-Time Password</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f5f5f5;">
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f5;">
    <tr>
    <td align="center" style="padding:20px 10px;">
    
    <!--[if mso]>
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0">
    <tr>
    <td>
    <![endif]-->
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;">
    
    
    <!-- Header -->
    <tr>
    <td align="center" bgcolor="#27ae60" style="padding:30px 20px;">
    <img
    src="https://lockermedia.s3.amazonaws.com/undefined/1770038121918_locker.jpeg"
    alt="Locker Logo"
    width="140"
    border="0"
    style="display:block;width:140px;max-width:140px;height:auto;"
    >
    
    <div style="font-family:Arial, Helvetica, sans-serif;font-size:24px;line-height:32px;font-weight:bold;color:#ffffff;padding-top:15px;">
    🔐 Your One-Time Password
    </div>
    </td>
    </tr>
    
    <!-- Content -->
    <tr>
    <td style="padding:30px;font-family:Arial, Helvetica, sans-serif;font-size:14px;line-height:24px;color:#555555;">
    
    <p style="margin:0 0 20px 0;">
    A request has been made to verify your identity for your Locker account. Use the code below to proceed:
    </p>
    
    <!-- OTP Box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f4ff;margin:20px 0;">
    <tr>
    <td width="4" bgcolor="#38de7d" style="font-size:0;line-height:0;">&nbsp;</td>
    <td align="center" style="padding:20px;">

                    <div style="font-family:Arial, Helvetica, sans-serif;font-size:13px;font-weight:bold;color:rgba(54,188,92,0.9);margin-bottom:10px;">
                        Enter this code:
                    </div>

                    <div style="font-family:'Courier New', Courier, monospace;font-size:42px;font-weight:bold;color:#38de7d;letter-spacing:3px;line-height:48px;">
                    ${otp}
                    </div>

                </td>
            </tr>
            </table>
            
            <p style="margin:20px 0 0 0;">
            <strong>Didn't request this?</strong>
            If you did not request this code, please ignore this email or contact support immediately.
            </p>
            
            </td>
            </tr>

            <!-- Footer -->
            <tr>
            <td style="background-color:#f8f9fa;padding:20px;border-top:1px solid #e0e0e0;text-align:center;font-family:Arial, Helvetica, sans-serif;font-size:12px;line-height:20px;color:#888888;">
            <div>
            This is an automated message from the Locker system.
            </div>
            
            <div style="padding-top:10px;">
            © 2026 Locker. All rights reserved.
            </div>
            </td>
            </tr>
            
            </table>
            
            <!--[if mso]>
            </td>
            </tr>
            </table>
            <![endif]-->
            
            </td>
            </tr>
            </table>
            
            </body>
            </html>`;

    const response = await SendEmailTemplet(email, "Locker - One-Time Password for Your Account", null, html);

    return otp;
};

export const sendUserEmail = async (email: string, data: any): Promise<any> => {
    const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Message for You</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f5f5f5;">
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f5;">
    <tr>
    <td align="center" style="padding:20px 10px;">
    
    <!--[if mso]>
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0">
    <tr>
    <td>
    <![endif]-->
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;">
    
    <!-- Header -->
    <tr>
    <td align="center" bgcolor="#667eea" style="padding:30px 20px;">
    <img
    src="https://lockermedia.s3.amazonaws.com/undefined/1770038121918_locker.jpeg"
    alt="Locker Logo"
    width="140"
    border="0"
    style="display:block;width:140px;max-width:140px;height:auto;"
    >
    
    <div style="font-family:Arial, Helvetica, sans-serif;font-size:24px;line-height:32px;font-weight:bold;color:#ffffff;padding-top:15px;">
    📧 Message for You
    </div>
    </td>
    </tr>
    
    <!-- Content -->
    <tr>
    <td style="padding:30px;font-family:Arial, Helvetica, sans-serif;color:#555555;">
    
    <!-- Subject Box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f9fa;margin-bottom:20px;">
    <tr>
    <td width="4" bgcolor="#667eea" style="font-size:0;line-height:0;">&nbsp;</td>
    <td style="padding:15px;">
    <div style="font-size:16px;font-weight:bold;color:#2c3e50;line-height:24px;">
    ${data.subject || 'New Message'}
    </div>
    </td>
    </tr>
    </table>
    
    <!-- Message Content -->
    <div style="font-size:14px;line-height:24px;color:#555555;white-space:pre-wrap;word-break:break-word;">
    ${data.message}
    </div>
    
    <!-- Divider -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
    <td style="padding-top:20px;padding-bottom:20px;">
    <div style="border-top:1px solid #e0e0e0;font-size:0;line-height:0;">&nbsp;</div>
    </td>
    </tr>
    </table>
    
    <!-- Button -->
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0">
    <tr>
    <td bgcolor="#667eea" align="center" style="padding:10px 24px;">
    <a
    href="${process.env.FRONTEND}"
    style="font-family:Arial, Helvetica, sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;display:inline-block;"
    >
    View in Locker
    </a>
    </td>
    </tr>
    </table>
    
    </td>
    </tr>
    
    <!-- Footer -->
    <tr>
    <td style="background-color:#f8f9fa;padding:20px;border-top:1px solid #e0e0e0;text-align:center;font-family:Arial, Helvetica, sans-serif;color:#888888;">
    
    <div style="font-size:12px;line-height:20px;">
    From: <strong>${data.adminName || 'Locker Administrator'}</strong>
    </div>
    
    <div style="font-size:11px;line-height:18px;padding-top:10px;">
    This is an automated message from the Locker system. Please do not reply to this email.
    </div>
    
    <div style="font-size:12px;line-height:20px;padding-top:8px;color:#999999;">
    © 2026 Locker. All rights reserved.
    </div>
    
    </td>
    </tr>
    
    </table>
    
    <!--[if mso]>
    </td>
    </tr>
    </table>
    <![endif]-->
    
    </td>
    </tr>
    </table>
    
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
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f5f8fb;">
        
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f8fb;">
        <tr>
        <td align="center" style="padding:30px 10px;">
        
        <!--[if mso]>
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0">
        <tr>
        <td>
        <![endif]-->
        
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;">
        
        <!-- Header -->
        <tr>
        <td align="center" bgcolor="#16a085" style="padding:34px 24px;">
        
        <img
        src="https://lockermedia.s3.amazonaws.com/undefined/1770038121918_locker.jpeg"
        alt="Locker Logo"
        width="140"
        border="0"
        style="display:block;width:140px;max-width:140px;height:auto;"
        >
        
        <div style="font-family:Arial, Helvetica, sans-serif;font-size:24px;line-height:32px;font-weight:bold;color:#ffffff;padding-top:14px;">
        ${title}
        </div>
        
        </td>
        </tr>
        
        <!-- Content -->
        <tr>
        <td style="padding:32px 28px 24px 28px;font-family:Arial, Helvetica, sans-serif;">
        
        <div style="font-size:16px;line-height:28px;color:#49535f;margin-bottom:22px;">
        Congratulations! You have been granted admin access to ${scopeLabel.toLowerCase()} level permissions within Locker.
        </div>
        
        <!-- Meta Information -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#effaf6;margin:20px 0;">
        <tr>
        <td width="4" bgcolor="#16a085" style="font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:18px 20px;font-family:Arial, Helvetica, sans-serif;font-size:14px;line-height:24px;color:#2f4858;">
        
        ${assignedByLine}
        
        ${scopeValue ? `
            <div style="margin-top:10px;">
            <strong style="color:#1c363f;">${scopeLabel}:</strong>
            ${scopeValue}
            </div>
            ` : ""}
            
            </td>
            </tr>
            </table>
            
            <!-- Scope Box -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#16a085" style="margin:24px 0;">
            <tr>
            <td align="center" style="padding:22px 18px;font-family:Arial, Helvetica, sans-serif;color:#ffffff;">
            
            <div style="font-size:13px;line-height:20px;text-transform:uppercase;letter-spacing:1px;opacity:0.9;">
            Assigned Scope
            </div>
            
            <div style="font-size:20px;line-height:28px;font-weight:bold;padding-top:8px;">
            ${scopeValue || `New ${scopeLabel}`}
            </div>
            
            </td>
            </tr>
            </table>
            
            ${loginUrl ? `
                <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
                <tr>
                <td bgcolor="#16a085" align="center" style="padding:14px 28px;">
                <a
                href="${loginUrl}"
                style="font-family:Arial, Helvetica, sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;display:inline-block;"
                >
                Login to Locker
                </a>
                </td>
                </tr>
                </table>
                ` : ""}
                
                <div style="font-size:16px;line-height:28px;color:#49535f;margin-top:24px;">
                If you have any questions about your access or need assistance, please reach out to your administrator.
                </div>
                
                </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                <td style="background-color:#f3f7f9;padding:18px 24px;border-top:1px solid #e8eff2;text-align:center;font-family:Arial, Helvetica, sans-serif;font-size:13px;line-height:22px;color:#7a8692;">
                This message was sent automatically by Locker. Please do not reply to this email.
                </td>
                </tr>
                
                <tr>
                <td style="background-color:#f3f7f9;text-align:center;font-family:Arial, Helvetica, sans-serif;font-size:12px;line-height:20px;color:#999999;padding:0 24px 18px;">
                © 2026 Locker. All rights reserved.
                </td>
                </tr>
                </table>
                
                <!--[if mso]>
                </td>
                </tr>
                </table>
                <![endif]-->
                
                </td>
                </tr>
                </table>
                
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
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Survey Assigned</title>
    </head>
    
    <body style="margin:0;padding:0;background-color:#eef6fc;">
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef6fc;">
    <tr>
    <td align="center" style="padding:28px 10px;">
    
    <!--[if mso]>
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0">
    <tr>
    <td>
    <![endif]-->
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background-color:#ffffff;">
    
    
    <!-- Header -->
    <tr>
    <td align="center" bgcolor="#2980b9" style="padding:36px 24px;">
    
    <img src="https://lockermedia.s3.amazonaws.com/undefined/1770038121918_locker.jpeg" alt="Locker Logo" width="140" border="0" style="display:block;width:140px;max-width:140px;height:auto;">
    
    <div style="font-family:Arial, Helvetica, sans-serif;font-size:24px;line-height:32px;font-weight:bold;color:#ffffff;padding-top:14px;">
    📋 Survey Assigned
    </div>
    
    </td>
    </tr>
    
    <!-- Content -->
    <tr>
    <td style="padding:32px 28px;font-family:Arial, Helvetica, sans-serif;">
    
    <div style="font-size:16px;line-height:30px;color:#33475b;margin-bottom:20px;">
    ${userName ? `Hello ${userName},` : 'Hello,'}
    You have a new survey assignment in Locker. Please review the details below and complete the survey at your earliest convenience.
    </div>
    
    <!-- Survey Box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#2980b9" style="margin:24px 0;">
    <tr>
    <td align="center" style="padding:24px 20px;font-family:Arial, Helvetica, sans-serif;color:#ffffff;">
    
    <div style="font-size:13px;line-height:20px;text-transform:uppercase;letter-spacing:1px;opacity:0.9;">
    Assigned Survey
    </div>
    
    <div style="font-size:22px;line-height:32px;font-weight:bold;padding-top:8px;">
    ${surveyName}
    </div>
    
    
    </td>
    </tr>
    <tr>
    
    </tr>
    </table>
    
    <!-- Info Box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eff5fb;margin-top:26px;">
    <tr>
    <td align="center" width="4" bgcolor="#2980b9" style="font-size:0;line-height:0;">&nbsp;</td>
    
    <td align="center" style="padding:18px 20px;font-family:Arial, Helvetica, sans-serif;font-size:14px;line-height:24px;color:#3b5978;">
    <a href="${surveyLink}" target="_blank" style="color:#2980b9;font-weight:bold;text-decoration:underline;">
    Open Survey
    </a>
    <br><br>
    Note: The survey link is unique to this assignment. If you need help, please contact your administrator or log in to the Locker system.
    
    </td>
    </tr>
    </table>
    
    </td>
    </tr>
    
    
    <!-- Footer -->
    <tr>
    <td style="padding:24px 28px 30px;background-color:#ffffff;font-family:Arial, Helvetica, sans-serif;font-size:13px;line-height:22px;color:#6b7f94;border-top:1px solid #e6eef5;">
    <div style="text-align:center;">
    This is an automated message from the Locker system. Please do not reply to this email.
    </div>
    
    <div style="text-align:center;font-size:12px;color:#999999;padding-top:8px;">
    © 2026 Locker. All rights reserved.
    </div>
    </td>
    </tr>
    
    
    </table>
    
    <!--[if mso]>
    </td>
    </tr>
    </table>
    <![endif]-->
    
    </td>
    </tr>
    </table>
    
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
<html>

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Broadcast Message</title>
</head>

<body style="margin:0;padding:0;background-color:#f5f5f5;">

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f5f5f5;">
        <tr>
            <td align="center" style="padding:20px 10px;">

                <!--[if mso]>
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0">
<tr>
<td>
<![endif]-->

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background:#ffffff;">

                    <!-- Header -->
                    <tr>
                        <td align="center" bgcolor="#667eea" style="padding:30px 20px;">
                            <img src="https://lockermedia.s3.amazonaws.com/undefined/1770038121918_locker.jpeg" alt="Locker Logo" width="140" style="display:block;border:0;outline:none;text-decoration:none;">

                            <div style="
                    font-family:Arial,Helvetica,sans-serif;
                    font-size:24px;
                    line-height:32px;
                    color:#ffffff;
                    font-weight:bold;
                    margin-top:15px;
                ">
                                📢 New Broadcast Message
                            </div>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding:30px;">

                            <div style="
                    font-family:Arial,Helvetica,sans-serif;
                    font-size:22px;
                    line-height:30px;
                    color:#2c3e50;
                    font-weight:bold;
                    border-bottom:3px solid #667eea;
                    padding-bottom:10px;
                ">
                                ${data.title}
                            </div>

                            <div style="
                    margin-top:20px;
                    font-family:Arial,Helvetica,sans-serif;
                    font-size:14px;
                    line-height:24px;
                    color:#555555;
                ">
                                ${data.description}
                            </div>

                            <!-- Meta Box -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="
                    margin-top:20px;
                    background:#f8f9fa;
                    border-left:4px solid #667eea;
                ">
                                <tr>
                                    <td style="
                            padding:15px;
                            font-family:Arial,Helvetica,sans-serif;
                            font-size:13px;
                            color:#666666;
                            line-height:22px;
                        ">
                                        ${data.senderName ? `
                                        <strong style="color:#2c3e50;">Sent by:</strong>
                                        ${data.senderName}<br>
                                        ` : ''}

                                        <strong style="color:#2c3e50;">
                                            Date & Time:
                                        </strong>
                                        ${sentDate}
                                    </td>
                                </tr>
                            </table>

                            <!-- CTA -->

                            ${loginUrl ? `
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin-top:25px;">
                                <tr>
                                    <td bgcolor="#667eea" style="padding:12px 28px;">
                                        <a href="${loginUrl}" style="
                                font-family:Arial,Helvetica,sans-serif;
                                color:#ffffff;
                                text-decoration:none;
                                font-weight:bold;
                                font-size:14px;
                            ">
                                            View in Locker
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            ` : ''}

                            <div style="
                    margin-top:25px;
                    font-family:Arial,Helvetica,sans-serif;
                    font-size:13px;
                    line-height:22px;
                    color:#666666;
                ">
                                You have received this broadcast message as part of your
                                organization's communications. Please log in to your Locker
                                account to view more details or respond if needed.
                            </div>

                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td bgcolor="#f8f9fa" style="
                padding:20px;
                border-top:1px solid #dddddd;
                text-align:center;
                font-family:Arial,Helvetica,sans-serif;
                font-size:12px;
                color:#888888;
                line-height:20px;
            ">
                            This is an automated message from the Locker system.
                            Please do not reply to this email.

                            <br><br>

                            © 2026 Locker. All rights reserved.
                        </td>
                    </tr>

                </table>

                <!--[if mso]>
</td>
</tr>
</table>
<![endif]-->

            </td>
        </tr>
    </table>

</body>

</html>`;


        const response = await SendEmailTemplet(email, `Locker Broadcast: ${data.title}`, null, html);
        return true;
    } catch (error) {
        console.log('Error sending broadcast email:', error);
        return false;
    }
};