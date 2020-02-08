import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as moment from 'moment';
import axios from 'axios';
import * as qs from 'querystring';
import * as stringSimilarity from 'string-similarity';
import {
    Customer,
    FreeFinanceInvoice,
    InvoiceItem,
    DiscountMode,
    MagentoOrder,
    RegionResponse
} from './types';
import * as Configuration from './configuration.json';

export const getRegionCode = async (
    access_token: string,
    countryCode: string,
    region: string
): Promise<RegionResponse> => {
    const config = {
        headers: {
            Authorization: `Bearer ${access_token}`
        }
    };

    const regionCodesRes = await axios
        .get(
            `${
                functions.config().freefinance.url
            }/api/1.1/countries/${countryCode}/regions`,
            config
        )
        .catch(function(error) {
            console.log(error);
            console.log(error.response);
            console.log(error.response.data);
            console.log(error.response.status);
            console.log(error.response.headers);
        });

    if (!regionCodesRes) {
        throw Error('Region Code not found');
    }

    interface FreeFinanceRegion {
        id: string;
        name: string;
    }

    const regionCodes: FreeFinanceRegion[] = regionCodesRes.data;

    const sortedRegionCodes = regionCodes.sort((a, b) => {
        const resultA = stringSimilarity.compareTwoStrings(region, a.name);
        const resultB = stringSimilarity.compareTwoStrings(region, b.name);
        if (resultA === resultB) {
            return 0;
        } else if (resultA > resultB) {
            return -1;
        } else {
            return 1;
        }
    });

    if (sortedRegionCodes[0]?.id) {
        return {
            region: sortedRegionCodes[0].id,
            error: false
        };
    } else {
        return {
            error: true
        };
    }
};

export const getNewAccessToken = async () => {
    const authDataSnapshot = await admin
        .database()
        .ref('/freefinance/auth')
        .once('value');

    const authData = authDataSnapshot.val();

    const config = {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };

    const requestBody = {
        grant_type: 'refresh_token',
        refresh_token: authData.refresh_token,
        client_id: functions.config().freefinance.client_id
    };

    const tokenRes = await axios
        .post(
            `${functions.config().freefinance.url}/oauth2/token`,
            qs.stringify(requestBody),
            config
        )
        .catch(function(error) {
            console.log(error);
            console.log(error.response);
            console.log(error.response.data);
            console.log(error.response.status);
            console.log(error.response.headers);
        });

    if (tokenRes) {
        const { access_token, refresh_token } = tokenRes.data;

        await admin
            .database()
            .ref('/freefinance/auth')
            .update({
                access_token,
                refresh_token
            });

        return access_token;
    }

    return;
};

export const getTokenWithCode = async (code: string) => {
    const config = {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };

    const requestBody = {
        grant_type: 'authorization_code',
        code,
        client_id: functions.config().freefinance.client_id,
        client_secret: functions.config().freefinance.client_secret
    };

    const tokenRes = await axios
        .post(
            `${functions.config().freefinance.url}/oauth2/token`,
            qs.stringify(requestBody),
            config
        )
        .catch(function(error) {
            console.log(error);
            console.log(error.response);
            console.log(error.response.data);
            console.log(error.response.status);
            console.log(error.response.headers);
        });

    if (tokenRes) {
        const { access_token, refresh_token } = tokenRes.data;
        await admin
            .database()
            .ref('/freefinance/auth')
            .update({
                access_token,
                refresh_token
            });

        return tokenRes.data;
    }

    return;
};

export const getCreateUpdtaeCustomer = async (
    access_token: string,
    customer: Customer
): Promise<Customer> => {
    let finalCustomer = await getCustomer(
        access_token,
        customer.customerNumber
    );

    if (!finalCustomer) {
        finalCustomer = await createCustomer(access_token, customer);
    } else {
        await updateCustomerIfChanges(access_token, finalCustomer, customer);
    }

    return finalCustomer;
};

const getCustomer = async (
    access_token: string,
    customerNumber?: string
): Promise<Customer | undefined> => {
    const config = {
        headers: {
            Authorization: `Bearer ${access_token}`
        }
    };

    const customersRespons = await axios
        .get(`${functions.config().freefinance.url}/api/1.1/customers`, config)
        .catch(function(error) {
            console.log(error);
            console.log(error.response);
            console.log(error.response.data);
            console.log(error.response.status);
            console.log(error.response.headers);
        });

    if (!customersRespons) {
        throw Error('No Customer found');
    }

    const customers = customersRespons.data;

    const foundCustomer = customers.find(
        (customer: any) => customer.customerNumber === customerNumber
    );

    if (foundCustomer) {
        return foundCustomer;
    }

    return;
};

const createCustomer = async (
    access_token: string,
    customer: Customer
): Promise<Customer> => {
    const config = {
        headers: {
            Authorization: `Bearer ${access_token}`
        }
    };

    const requestBody = {
        ...customer,
        noVatNumber: !customer.taxNumber
    };

    const newCustomerResponse = await axios
        .post(
            `${functions.config().freefinance.url}/api/1.1/customers`,
            requestBody,
            config
        )
        .catch(function(error) {
            console.log(error);
            console.log(error.response);
            console.log(error.response.data);
            console.log(error.response.status);
            console.log(error.response.headers);
        });

    if (!newCustomerResponse) {
        throw Error('Could not create Customer');
    }

    const newCustomer = newCustomerResponse.data;

    return newCustomer;
};

const updateCustomerIfChanges = async (
    access_token: string,
    oldCustomer: Customer,
    newCustomer: Customer
) => {
    try {
        const emailAddress =
            newCustomer.emailAddress !== oldCustomer.emailAddress;

        const mobileNumber =
            newCustomer.mobileNumber !== oldCustomer.mobileNumber;

        const taxNumber = newCustomer.taxNumber !== oldCustomer.taxNumber;

        const companyName = newCustomer.companyName !== oldCustomer.companyName;

        const firstName = newCustomer.firstName !== oldCustomer.firstName;

        const lastName = newCustomer.lastName !== oldCustomer.lastName;

        const streetName = newCustomer.streetName !== oldCustomer.streetName;

        const zipCode = newCustomer.zipCode !== oldCustomer.zipCode;

        const city = newCustomer.city !== oldCustomer.city;

        const country = newCustomer.country !== oldCustomer.country;

        const region = newCustomer.region !== oldCustomer.region;

        const attribute1 = newCustomer.attribute1 !== oldCustomer.attribute1;

        const attribute5 = newCustomer.attribute5 !== oldCustomer.attribute5;

        if (
            emailAddress ||
            mobileNumber ||
            taxNumber ||
            companyName ||
            firstName ||
            lastName ||
            streetName ||
            zipCode ||
            city ||
            country ||
            region ||
            attribute1 ||
            attribute5
        ) {
            const config = {
                headers: {
                    Authorization: `Bearer ${access_token}`
                }
            };

            const requestBody = {
                ...newCustomer,
                noVatNumber: !newCustomer.taxNumber
            };

            const updateCustomerResponse = await axios
                .put(
                    `${functions.config().freefinance.url}/api/1.1/customers/${
                        oldCustomer.id
                    }`,
                    requestBody,
                    config
                )
                .catch(function(error) {
                    console.log(error);
                    console.log(error.response);
                    console.log(error.response.data);
                    console.log(error.response.status);
                    console.log(error.response.headers);
                });

            if (!updateCustomerResponse) {
                throw Error('Could not update Customer');
            }
            console.log('Customer Updated');
        }
    } catch (e) {
        console.log(e);
    }
};

const compareAddresses = (order: MagentoOrder): string => {
    try {
        const shippingAddress =
            order.extension_attributes.shipping_assignments[0].shipping.address;
        const billingAddress = order.billing_address;

        const city = shippingAddress.city !== billingAddress.city;
        const company = shippingAddress.company !== billingAddress.company;
        const countryId =
            shippingAddress.country_id !== billingAddress.country_id;
        const firstname =
            shippingAddress.firstname !== billingAddress.firstname;
        const lastname = shippingAddress.lastname !== billingAddress.lastname;
        const postcode = shippingAddress.postcode !== billingAddress.postcode;
        const street = shippingAddress.street[0] !== billingAddress.street[0];
        const region = shippingAddress.region !== billingAddress.region;
        const regionCode =
            shippingAddress.region_code !== billingAddress.region_code;

        if (
            city ||
            company ||
            countryId ||
            firstname ||
            lastname ||
            postcode ||
            street ||
            region ||
            regionCode
        ) {
            return '!Liefer- und Rechnungsadresse sind unterschiedlich!';
        } else {
            return 'Adressen sind gleich.';
        }
    } catch (e) {
        console.log(e);
    }
    return '';
};

const shippingAdressString = (shippingAddress: any): string => {
    const {
        company,
        firstName,
        lastName,
        postcode,
        street,
        city,
        country_id,
        region
    } = shippingAddress;
    let addressString = '';

    if (company) {
        addressString += company + '\n';
    }
    if (firstName || lastName) {
        addressString += `${firstName || ''} ${lastName || ''}` + '\n';
    }
    if (street[0]) {
        addressString += street[0] + '\n';
    }
    if (postcode || city) {
        addressString += `${postcode || ''} ${city || ''}` + '\n';
    }
    if (region) {
        addressString += region + '\n';
    }
    if (country_id) {
        addressString += country_id + '\n';
    }
    return addressString;
};

export const createInvoice = async (
    access_token: string,
    customer: Customer,
    magentoOrder: MagentoOrder,
    // Order Comment is optional Text field placed in internal description
    orderComment?: string,
    regionError?: string | undefined
): Promise<any> => {
    const roundToTwo = (num: number): number => {
        return Math.round((num + Number.EPSILON) * 100) / 100;
    };

    const allItems = await getFreeFinanceItems(access_token);

    // Filter out configurable items
    const filteredItems = magentoOrder.items.filter(item => {
        return item.product_type !== 'configurable';
    });

    const lines: InvoiceItem[] = filteredItems.map(
        (lineItem): InvoiceItem => {
            const parentItem = lineItem?.parent_item;
            type ItemType = typeof lineItem & typeof parentItem;

            let item = lineItem as ItemType;

            //Check if there is a parent item because of configurable product. Use parent if availabe
            if (lineItem?.parent_item) {
                item = parentItem as ItemType;
                //Use name of original parent
                item.name = lineItem?.name;
            }

            const discount = roundToTwo(
                Math.abs(item.discount_amount) / item.qty_ordered
            );

            const brutPrice = roundToTwo(
                (item.base_price_incl_tax - Math.abs(discount)) *
                    item.qty_ordered
            );

            const netPrice = roundToTwo(
                (brutPrice / (100 + item.tax_percent)) * 100
            );

            const taxPrice = roundToTwo(
                (brutPrice / (100 + item.tax_percent)) * item.tax_percent
            );

            const itemID = getItemIDbyItemNumber(allItems, item.sku);

            return {
                item: itemID,
                itemNumber: item.sku,
                name: item.name,
                amount: item.qty_ordered,
                account: '4000',
                taxClassEntry:
                    item.tax_percent < 10
                        ? `00${item.tax_percent}`
                        : `0${item.tax_percent}`,
                itemPrice: item.base_price_incl_tax,
                itemPriceType: 'T',
                netPrice,
                taxPrice,
                totalPrice: brutPrice,
                discount: discount,
                discountMode: DiscountMode.CONSTANT,
                unitOfMeasure: 'PC'
            };
        }
    );

    // Add Shipping Cost Line
    lines.push({
        itemNumber: 'Versandkosten',
        name: magentoOrder.shipping_description,
        amount: 1,
        account: '4000',
        taxClassEntry: `000`,
        itemPrice: magentoOrder.shipping_amount,
        itemPriceType: 'T',
        netPrice:
            magentoOrder.shipping_amount -
            Math.abs(magentoOrder.shipping_discount_amount),
        taxPrice: 0,
        discount: magentoOrder.shipping_discount_amount,
        discountMode: DiscountMode.CONSTANT,
        totalPrice:
            magentoOrder.shipping_amount -
            Math.abs(magentoOrder.shipping_discount_amount)
    });

    const shippingAddress =
        magentoOrder.extension_attributes.shipping_assignments[0].shipping
            .address;
    const shippingAddressMessage = compareAddresses(magentoOrder);

    let internalDescription = '';
    internalDescription += shippingAddressMessage + '\n';

    if (regionError) {
        internalDescription += regionError + '\n';
    }

    internalDescription += '\n';

    if (magentoOrder.customer_note) {
        internalDescription += magentoOrder.customer_note + '\n';
    }
    if (orderComment) {
        internalDescription += orderComment + '\n';
    }

    internalDescription += '\n';

    if (magentoOrder.payment.additional_information[0]) {
        internalDescription +=
            magentoOrder.payment.additional_information[0] + '\n';
    }
    if (magentoOrder.payment.method) {
        internalDescription += magentoOrder.payment.method + '\n';
    }

    let paymentMethod =
        Configuration.paymentMethods[
            magentoOrder.payment
                .method as keyof typeof Configuration.paymentMethods
        ];

    if (!paymentMethod) {
        paymentMethod = Configuration.fallbackPaymentMethod;
    }

    internalDescription +=
        '\n' + 'Lieferadresse:' + '\n' + shippingAdressString(shippingAddress);

    const invoiceData: FreeFinanceInvoice = {
        state: 'STAGING',
        date: moment().format('YYYY-MM-DD[T]HH:mm:ss.SSS[Z]'),
        paymentTerm: paymentMethod,
        lines,
        customer: customer.id,
        internalDescription,
        referenceText: `Bestellung ${magentoOrder.increment_id}`,
        referenceDate: moment(magentoOrder.created_at).format(
            'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]'
        )
    };

    // export interface FreeFinanceInvoice {
    //     customer?: string;
    //     date?: string;
    //     internalDescription?: string;
    //     state?: string;
    //     referenceText?: string;
    //     referenceDate?: string;
    //     signed?: boolean;
    //     paymentTerm?: PaymentTerm;
    //     lines?: InvoiceItem[];
    //     description?: string;
    //     footer?: string;
    //     paid?: boolean;
    //     paidDate?: string;
    // }

    const config = {
        headers: {
            Authorization: `Bearer ${access_token}`
        }
    };

    const newInvoiceResponse = await axios
        .post(
            `${functions.config().freefinance.url}/api/1.1/invoices`,
            invoiceData,
            config
        )
        .catch(function(error) {
            console.log(error);
            console.log(error.response);
            console.log(error.response.data);
            console.log(error.response.status);
            console.log(error.response.headers);
        });

    if (!newInvoiceResponse) {
        throw Error('Invoice not creatd');
    }

    return newInvoiceResponse.data;
};

const getFreeFinanceItems = async (
    access_token: string
): Promise<InvoiceItem[]> => {
    const config = {
        headers: {
            Authorization: `Bearer ${access_token}`
        }
    };

    const itemsResponse = await axios
        .get(`${functions.config().freefinance.url}/api/1.1/items`, config)
        .catch(function(error) {
            console.log(error);
            console.log(error.response);
            console.log(error.response.data);
            console.log(error.response.status);
            console.log(error.response.headers);
        });

    if (!itemsResponse) {
        throw Error('Freefinanc Items not fetched');
    }

    return itemsResponse.data;
};

const getItemIDbyItemNumber = (
    items: any[],
    itemNumber: string
): string | undefined => {
    const foundItem = items.find(item => item.number === itemNumber);
    return foundItem?.id;
};

const getMagentoOrdersByIncreamentID = async (
    increment_id: string
): Promise<MagentoOrder[]> => {
    const magentoOrderConfig = {
        headers: {
            Authorization: `Bearer ${functions.config().magento.access_token}`
        }
    };

    const url = `/rest/V1/orders?searchCriteria[filter_groups][0][filters][0][field]=increment_id&searchCriteria[filter_groups][0][filters][0][value]=${increment_id}&searchCriteria[filter_groups][0][filters][0][condition_type]=eq`;

    const magentoOrderRes = await axios
        .get(`${functions.config().magento.url}${url}`, magentoOrderConfig)
        .catch(function(error) {
            console.log(error);
        });

    if (!magentoOrderRes) {
        throw Error('There is no Magento Orders Response');
    }

    return magentoOrderRes.data.items;
};

export const getOrderEntityIDbyIncrementID = async (
    increment_id: string
): Promise<number | undefined> => {
    const orders = await getMagentoOrdersByIncreamentID(increment_id);

    const foundOrder = orders.find(
        order => order.increment_id === increment_id
    );

    return foundOrder?.entity_id;
};
