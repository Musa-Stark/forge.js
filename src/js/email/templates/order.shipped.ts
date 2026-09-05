import type { OrderShippedEmailPlaceholders } from "../../types/email/order.shipped.type.js";

const orderShippedEmail = ({
  orderNumber,
  carrierName,
  companyUrl,
  companyName,
  userName,
  trackingNumber,
  estimatedDelivery,
  trackingUrl,
  companyAddress,
  userEmail,
  supportEmail,
  unsubscribeUrl,
  currentYear,
}: OrderShippedEmailPlaceholders): string => {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Your order has shipped — ${orderNumber}</title>
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
  a { color: #9333EA; }
  @media screen and (max-width: 600px) {
    .email-container { width: 100% !important; }
    .fluid-padding { padding-left: 24px !important; padding-right: 24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F1F5F9;">
    Your order is on its way via ${carrierName}.
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
        <tr><td style="height:4px;line-height:4px;font-size:4px;background-color:#9333EA;border-radius:16px 16px 0 0;" bgcolor="#9333EA">&nbsp;</td></tr>
        <tr>
          <td class="fluid-padding" style="padding:40px 40px 36px 40px;">

            
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
      <tr>
        <td width="56" height="56" style="width:56px;height:56px;border-radius:16px;background-color:#F2E7FC;text-align:center;vertical-align:middle;" bgcolor="#F2E7FC">
          <div style="font-size:0;line-height:0;"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#9333EA" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="7.5" width="11.5" height="8.5" rx="1"/><path d="M13.5 10h3.7l3.3 3v3H13.5"/><circle cx="6.2" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg></div>
        </td>
      </tr>
    </table>

            <h1 style="margin:0 0 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:28px;font-weight:700;color:#0F172A;letter-spacing:-0.02em;">
              Your order is on its way
            </h1>

            <p style="margin:0 0 14px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:24px;color:#475569;">Hi ${userName}, good news — order <strong>${orderNumber}</strong> has shipped.</p>
            
            
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0;">
      <tr>
        <td style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:4px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            
          <tr>
            <td style="padding:12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#94A3B8;" width="42%">Carrier</td>
            <td style="padding:12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#0F172A;font-weight:600;text-align:right;">${carrierName}</td>
          </tr>
          <tr>
            <td style="padding:12px 0;border-top:1px solid #E2E8F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#94A3B8;" width="42%">Tracking number</td>
            <td style="padding:12px 0;border-top:1px solid #E2E8F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#0F172A;font-weight:600;text-align:right;">${trackingNumber}</td>
          </tr>
          <tr>
            <td style="padding:12px 0;border-top:1px solid #E2E8F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#94A3B8;" width="42%">Estimated delivery</td>
            <td style="padding:12px 0;border-top:1px solid #E2E8F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#0F172A;font-weight:600;text-align:right;">${estimatedDelivery}</td>
          </tr>
          </table>
        </td>
      </tr>
    </table>
            
            
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 4px 0;">
      <tr>
        <td style="border-radius:10px;background-color:#9333EA;" bgcolor="#9333EA">
          <a href="${trackingUrl}" target="_blank"
             style="display:inline-block;padding:13px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;
                    color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:-0.01em;">
            Track shipment
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

export default orderShippedEmail;
