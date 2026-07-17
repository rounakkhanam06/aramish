const axios = require('axios');

async function test() {
    try {
        const res1 = await axios.post('http://localhost:5000/api/shiprocket/estimate', {
            deliveryPincode: '451551',
            weight: 0.5,
            cod: 0
        });
        console.log("Prepaid 0.5kg:", res1.data.deliveryCharge);

        const res2 = await axios.post('http://localhost:5000/api/shiprocket/estimate', {
            deliveryPincode: '451551',
            weight: 0.5,
            cod: 1
        });
        console.log("COD 0.5kg:", res2.data.deliveryCharge);
        
        const res3 = await axios.post('http://localhost:5000/api/shiprocket/estimate', {
            deliveryPincode: '451551',
            weight: 0.1,
            cod: 0
        });
        console.log("Prepaid 0.1kg:", res3.data.deliveryCharge);

        const res4 = await axios.post('http://localhost:5000/api/shiprocket/estimate', {
            deliveryPincode: '451551',
            weight: 0.1,
            cod: 1
        });
        console.log("COD 0.1kg:", res4.data.deliveryCharge);

    } catch (e) {
        console.error(e.message);
    }
}
test();
