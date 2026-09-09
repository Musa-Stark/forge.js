import type { MemberAddedEmailPlaceholders } from "../../types/email/member.added.type.js";

const memberAddedEmail = ({
  memberName,
  teamName,
  companyName,
  companyUrl,
  userName,
  memberEmail,
  memberRole,
  teamUrl,
  companyAddress,
  userEmail,
  supportEmail,
  unsubscribeUrl,
  currentYear,
}: MemberAddedEmailPlaceholders): string => {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${memberName} joined ${teamName}</title>
<!--[if mso]>
<noscript>
<xml>
<o:OfficeDocumentSettings>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
</noscript>
<style>table {border-collapse:collapse;} .fallback-font {font-family: Arial, sans-serif;}</style>
<![endif]-->
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: #F1F5F9; }
  a { color: #7C3AED; }
  @media screen and (max-width: 600px) {
    .email-container { width: 100% !important; }
    .fluid-padding { padding-left: 24px !important; padding-right: 24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F1F5F9;">
    A new member has joined your team on ${companyName}.
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>
  <center style="width:100%;background-color:#F1F5F9;">
    <!--[if mso]>
    <table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td>
    <![endif]-->
    <div class="email-container" style="max-width:600px;margin:0 auto;">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
        <tr>
          <td style="padding:36px 24px 20px 24px;text-align:center;">
            <a href="${companyUrl}" target="_blank" style="text-decoration:none;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:19px;font-weight:700;color:#0F172A;letter-spacing:-0.02em;">${companyName}</span>
            </a>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:600px;margin:0 auto;background-color:#FFFFFF;border-radius:16px;border:1px solid #E2E8F0;">
        <tr><td style="height:4px;line-height:4px;font-size:4px;background-color:#7C3AED;border-radius:16px 16px 0 0;" bgcolor="#7C3AED">&nbsp;</td></tr>
        <tr>
          <td class="fluid-padding" style="padding:40px 40px 36px 40px;">

            
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
      <tr>
        <td width="56" height="56" style="width:56px;height:56px;border-radius:16px;background-color:#EFE7FD;text-align:center;vertical-align:middle;" bgcolor="#EFE7FD">
          <div style="font-size:0;line-height:0;"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="8.2" r="3"/><path d="M3.2 19.5c0-3 2.6-5.2 5.8-5.2s5.8 2.2 5.8 5.2"/><circle cx="17" cy="9" r="2.3"/><path d="M20.8 19.5c0-2.3-1.7-4.2-4-4.7"/></svg></div>
        </td>
      </tr>
    </table>

            <h1 style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:28px;font-weight:700;color:#0F172A;letter-spacing:-0.02em;">
              A new member joined your team
            </h1>

            <p style="margin:0 0 14px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:24px;color:#475569;">Hi ${userName}, <strong>${memberName}</strong> (${memberEmail}) has joined <strong>${teamName}</strong> as a ${memberRole}.</p>
            
            
            
            
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 4px 0;">
      <tr>
        <td style="border-radius:10px;background-color:#7C3AED;" bgcolor="#7C3AED">
          <a href="${teamUrl}" target="_blank"
             style="display:inline-block;padding:13px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;
                    color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:-0.01em;">
            View team
          </a>
        </td>
      </tr>
    </table>
            
            

          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
        <tr>
          <td style="padding:28px 24px 8px 24px;text-align:center;">
            <p style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12.5px;line-height:18px;color:#94A3B8;">
              ${companyName} &middot; ${companyAddress}
            </p>
            <p style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12.5px;line-height:18px;color:#94A3B8;">
              This email was sent to ${userEmail}. Need help? <a href="mailto:${supportEmail}" style="color:#94A3B8;text-decoration:underline;">${supportEmail}</a>
            </p>
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12.5px;line-height:18px;color:#94A3B8;">
              <a href="${unsubscribeUrl}" style="color:#94A3B8;text-decoration:underline;">Unsubscribe</a>
              &nbsp;&middot;&nbsp;
              &copy; ${currentYear} ${companyName}. All rights reserved.
            </p>
          </td>
        </tr>
      </table>

    </div>
    <!--[if mso]></td></tr></table><![endif]-->
  </center>
</body>
</html>
`;
};

export default memberAddedEmail;
