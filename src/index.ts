import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import {
    getNewAccessToken,
    getTokenWithCode,
    getCreateUpdtaeCustomer,
    createInvoice,
    // getRegionCode,
    getOrderEntityIDbyIncrementID
} from './utils';
import { Customer, MagentoOrder } from './types';
// import * as magentoOrderJSON from './exampleMagentoOrder1.json';
// const magentoOrder = magentoOrderJSON as MagentoOrder;

admin.initializeApp();

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

export const freefinanceauth = functions.https.onRequest(async (req, res) => {
    // Grab the text parameter.
    const query = req.query;
    const body = req.body;
    const header = req.headers;
    const method = req.method;
    const params = req.params;

    if (query.state !== functions.config().freefinance.state) {
        res.send(`State parameter missing or wrong`);
    }

    //Log Auth Request
    await admin
        .database()
        .ref('/freefinanceauthRequest')
        .push({
            data: {
                query,
                body,
                header,
                method,
                params
            }
        });

    await admin
        .database()
        .ref('/freefinance/auth')
        .update({
            code: query.code
        });

    const tokens = await getTokenWithCode(query.code);

    // Redirect with 303 SEE OTHER to the URL of the pushed object in the Firebase console.
    // res.redirect(303, snapshot.ref.toString());
    res.send(
        `Sucsess Code: ${JSON.stringify(
            query
        )}, tokenRes.data: ${JSON.stringify(tokens)}`
    );
});

export const createfreefinanceinvoice = functions.https.onRequest(
    async (req, res) => {
        try {
            // Grab the text parameter.
            const query = req.query;
            const body = req.body;
            const header = req.headers;
            const method = req.method;
            const params = req.params;

            if (query.state !== functions.config().freefinance.state) {
                res.send(`State parameter missing or wrong`);
            }

            // Log request
            await admin
                .database()
                .ref('/createInvoiceRequest')
                .push({
                    data: {
                        query,
                        body,
                        header,
                        method,
                        params
                    }
                });

            // Your Google Cloud Platform project ID
            const projectId = functions.config().gcp.project_id;

            const topicName = functions.config().gcp.topic_name;

            const data = JSON.stringify({ method: 'createOrder', query, body });

            // Imports the Google Cloud client library
            const { PubSub } = require('@google-cloud/pubsub');

            // Creates a client; cache this for further use
            const pubSubClient = new PubSub({
                projectId: projectId
            });

            async function publishMessage() {
                const dataBuffer = Buffer.from(data);

                const messageId = await pubSubClient
                    .topic(topicName)
                    .publish(dataBuffer);

                res.send(
                    `Invoice Creation scheduled successfully. Message ${messageId} published. Data: ${JSON.stringify(
                        query
                    )}`
                );
            }

            await publishMessage();
        } catch (e) {
            res.send(e);
        }
    }
);

export const createInvoicePubSub = functions.pubsub
    .topic(functions.config().gcp.topic_name)
    .onPublish(async JSONmessage => {
        try {
            const message = JSONmessage.json;
            // Grab the text parameter.
            const query = message.query;
            const body = message.body;

            // Refresh Freefinance token
            const access_token = await getNewAccessToken();

            const magentoOrder: MagentoOrder = await getMagentoOrder(
                query.entity_id,
                query.increment_id
            );

            // If Region Provided in Magento Order, convert Magento Region Format to FreeFinance Region Format
            let regionCode: string | undefined = undefined;
            let regionError: string | undefined = undefined;
            // if (magentoOrder?.billing_address?.region) {
            //     const regionCodeResponse = await getRegionCode(
            //         access_token,
            //         magentoOrder?.billing_address?.country_id,
            //         magentoOrder?.billing_address?.region
            //     );
            //     if (regionCodeResponse.error) {
            //         regionError = `The Region was not found or doesn't exist: ${magentoOrder?.billing_address?.region}`;
            //     } else if (regionCodeResponse.region) {
            //         regionCode = regionCodeResponse.region;
            //     }
            // }

            // Map Customer Data
            const customerData: Customer = {
                customerNumber: String(magentoOrder?.customer_id),
                emailAddress: magentoOrder?.customer_email,
                mobileNumber: magentoOrder?.billing_address?.telephone,
                taxNumber: magentoOrder?.billing_address?.vat_id,
                companyName: magentoOrder?.billing_address?.company,
                firstName: magentoOrder?.billing_address?.firstname,
                lastName: magentoOrder?.billing_address?.lastname,
                streetName: magentoOrder?.billing_address?.street[0],
                zipCode: magentoOrder?.billing_address?.postcode,
                city: magentoOrder?.billing_address?.city,
                country: magentoOrder?.billing_address?.country_id,
                region: regionCode,
                attribute1: magentoOrder?.customer_group_id,
                attribute5: magentoOrder?.billing_address?.region
            };

            const customer = await getCreateUpdtaeCustomer(
                access_token,
                customerData
            );

            if (!customer) {
                throw Error('No Customer returned');
            }

            const newInvoice = await createInvoice(
                access_token,
                customer,
                magentoOrder,
                body.orderComment,
                regionError
            );

            if (!newInvoice) {
                throw Error('No invoice created');
            }

            // throw Error(
            //     `Finished: ${access_token}, Customer-ID: ${
            //         customer.id
            //     }, Invoice: ${JSON.stringify(newInvoice)}`
            // );
        } catch (e) {
            throw Error(e);
        }
    });

const getMagentoOrder = async (entity_id: number, increment_id: string) => {
    // Get Find EntityId if not provided
    let local_entity_id: number = 0;

    if (entity_id) {
        local_entity_id = entity_id;
    } else if (increment_id) {
        const foundEntityID = await getOrderEntityIDbyIncrementID(increment_id);
        if (typeof foundEntityID == 'number') {
            local_entity_id = foundEntityID;
        } else {
            throw Error('increment_id not found');
        }
    } else {
        throw Error('Please provide entity_id or increment_id');
    }

    // Fetch Order from Magento API
    const magentoOrderConfig = {
        headers: {
            Authorization: `Bearer ${functions.config().magento.access_token}`
        }
    };

    const sleep = require('util').promisify(setTimeout);

    let goOn = true;

    let magentoOrderRes;

    while (goOn) {
        magentoOrderRes = await axios
            .get(
                `${
                    functions.config().magento.url
                }/rest/V1/orders/${local_entity_id}`,
                magentoOrderConfig
            )
            .catch(function() {
                //Do nothing
            });

        if (magentoOrderRes) {
            goOn = false;
        } else {
            await sleep(1000);
        }
    }

    if (!magentoOrderRes) {
        throw Error('There is no Magento Order Response');
    } else {
        return magentoOrderRes.data;
    }
};
