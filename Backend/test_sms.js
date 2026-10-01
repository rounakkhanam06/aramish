const dotenv = require('dotenv');
dotenv.config();

const apiKey = process.env.SMS_INDIA_HUB_API_KEY;
const senderId = process.env.SMS_INDIA_HUB_SENDER_ID;
const peId = process.env.SMS_INDIA_HUB_PE_ID;
const templateId = process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID;
const rawUrl = process.env.SMS_INDIA_HUB_URL;
const gwid = process.env.SMS_INDIA_HUB_GWID;
const phone = '9999999999';
const otp = '123456';

async function test(appName, templateOverride) {
    const templatePattern = templateOverride || process.env.SMS_INDIA_HUB_TEMPLATE_TEXT;
    const message = templatePattern
        .replace(/\$\{appName\}|\{appName\}/g, appName)
        .replace(/\$\{otp\}|\{otp\}/g, otp);
    const encodedMsg = encodeURIComponent(message).replace(/%20/g, '+');
    let smsUrl = `${rawUrl}?APIKey=${apiKey}&senderid=${senderId}&channel=Trans&DCS=0&flashsms=0&number=91${phone}&text=${encodedMsg}&route=0&PEId=${peId}&DLTTemplateId=${templateId}`;
    
    console.log(`Testing template: "${message}"`);
    console.log(`URL: ${smsUrl.replace(apiKey, 'HIDDEN_KEY')}`);
    try {
        const res = await fetch(smsUrl);
        const text = await res.text();
        console.log('Response:', text);
    } catch(err) {
        console.error(err);
    }
}

async function run() {
    await test('Aramish', 'Welcome to the ${appName} powered by Appzeto.Your OTP for registration is ${otp}.BGADEC');
}
run();
