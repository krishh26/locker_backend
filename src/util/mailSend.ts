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
                body {
                    font-family: 'Arial', sans-serif;
                    background-color: #f0f0f0;
                    margin: 0;
                    padding: 0;
                    text-align: center;
                }
        
                .container {
                    max-width: 600px;
                    margin: 20px auto;
                    background-color: #ffffff;
                    padding: 20px;
                    border-radius: 10px;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                }
        
                .logo {
                    max-width: 150px;
                    height: auto;
                    margin-bottom: 20px;
                }
        
                .title {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: #333;
                }
        
                .message {
                    font-size: 16px;
                    margin-bottom: 20px;
                    color: #555;
                }
        
                .password {
                    font-weight: bold;
                    font-size: 20px;
                    color: #3498db;
                }
        
                .footer {
                    font-size: 16px;
                    color: #777;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <img class="logo" src="https://jeel1.s3.ap-south-1.amazonaws.com/logo/logo.svg" alt="Locker Logo">
        
                <div class="title">Password reset</div>
                <div class="message">
                    <p>Congratulations! Your account has been successfully created.</p>
                </div>
                <div class="password">Your new password is: <strong>${password}</strong></div>
                <div class="footer">
                    <p>Thank you for using Locker.</p>
                </div>
            </div>
        </body>
        </html>
        `

        const responce = await SendEmailTemplet(email, "Welcome", null, html)
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
                body {
                    font-family: 'Arial', sans-serif;
                    background-color: #f4f4f4;
                    margin: 0;
                    padding: 0;
                    text-align: center;
                }

                .container {
                    max-width: 600px;
                    margin: 30px auto;
                    background-color: #ffffff;
                    padding: 30px;
                    border-radius: 8px;
                    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
                }

                .logo {
                    max-width: 120px;
                    height: auto;
                    margin-bottom: 25px;
                }

                .title {
                    font-size: 26px;
                    font-weight: bold;
                    margin-bottom: 20px;
                    color: #333;
                }

                .message {
                    font-size: 16px;
                    line-height: 1.6;
                    color: #555;
                    margin-bottom: 30px;
                }

                .reset-btn {
                    display: inline-block;
                    padding: 15px 25px;
                    font-size: 16px;
                    color: #ffffff;
                    background-color: #3498db;
                    text-decoration: none;
                    border-radius: 5px;
                    box-shadow: 0 3px 6px rgba(52, 152, 219, 0.4);
                    transition: background-color 0.3s;
                }

                .reset-btn:hover {
                    background-color: #2980b9;
                }

                .footer {
                    font-size: 14px;
                    color: #888;
                    margin-top: 30px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <img class="logo" src="https://jeel1.s3.ap-south-1.amazonaws.com/logo/logo.svg" alt="Locker Logo">

                <div class="title">Reset Your Password</div>
                <div class="message">
                    <p>We received a request to reset your password. Click the button below to reset your password. This link will expire in 24 hours.</p>
                </div>
                <a href="${resetLink}" class="reset-btn">Reset Password</a>
                <div class="footer">
                    <p>If you did not request a password reset, you can ignore this email. Your password will remain the same.</p>
                    <p>Thank you for using Locker.</p>
                </div>
            </div>
        </body>
        </html>
        `;

        const response = await SendEmailTemplet(email, "Password Reset Request", null, html);
        return true;
    } catch (error) {
        console.log(error);
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
            body {
                font-family: 'Arial', sans-serif;
                background-color: #f0f0f0;
                margin: 0;
                padding: 0;
                text-align: center;
            }
    
            .container {
                max-width: 600px;
                margin: 20px auto;
                background-color: #ffffff;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            }
    
            .logo {
                max-width: 150px;
                height: auto;
                margin-bottom: 20px;
            }
    
            .title {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 20px;
                color: #333;
            }
    
            .message {
                font-size: 16px;
                margin-bottom: 20px;
                color: #555;
            }
    
            .otp {
                font-weight: bold;
                font-size: 32px;
                color: #3498db;
            }
    
            .footer {
                font-size: 16px;
                color: #777;
            }
        </style>
    </head>
    <body>
        <div class="container">
        <img class="adapt-img" src="https://jeel1.s3.ap-south-1.amazonaws.com/logo/logo.svg" alt style="display: block;" width="180">
            <div class="title">One-Time Password</div>
            <div class="message">
                <p>You are receiving this email because a request has been made to reset the password for your Locker account.</p>
            </div>
            <div class="otp"><strong>${otp}</strong></div>
            <div class="footer">
                <p>If you did not request a password reset or have any concerns, please ignore this email.</p>
                <p>Thank you for using Locker.</p>
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
                body {
                    font-family: 'Arial', sans-serif;
                    background-color: #f0f0f0;
                    margin: 0;
                    padding: 0;
                    text-align: center;
                }

                .container {
                    max-width: 600px;
                    margin: 20px auto;
                    background-color: #ffffff;
                    padding: 20px;
                    border-radius: 10px;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                }

                .text-section {
                    font-size: 14px;
                    color: #333;
                    text-align: left;
                }

                a {
                    color: #3498db;
                    text-decoration: none;
                }

                a:hover {
                    text-decoration: underline;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="text-section">
                    <p>${data.message}</p>
                    <p>Regards,</p>
                    <p>${data.adminName}</p>
                    <hr />
                    <p>DO NOT REPLY TO THIS EMAIL! To reply please login into the system: 
                    <a href="${process.env.FRONTEND}">Locker</a></p>
                    <p>Sent from the Locker system.</p>
                </div>
            </div>
        </body>
        </html>
        `;

    const response = await SendEmailTemplet(email, data.subject, null, html);

    return true;
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