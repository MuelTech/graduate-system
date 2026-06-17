export const sendMockEmail = (to: string, subject: string, message: string) => {
    console.log('\n=======================================');
    console.log('📧 MOCK EMAIL DISPATCHED');
    console.log('=======================================');
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log('---------------------------------------');
    console.log(message);
    console.log('=======================================\n');
};
