import * as magentoOrder from './exampleMagentoOrderType.json';
import * as magentoOrder2 from './exampleMagentoOrder.json';

type MagentoOrderJSONtype = typeof magentoOrder & typeof magentoOrder2;

export interface MagentoOrder extends MagentoOrderJSONtype {
    customer_note: string;
    billing_address: MagentoOrderJSONtype['billing_address'] & {
        region: string;
    };
}

export interface Customer {
    id?: string;
    noVatNumber?: boolean;
    customerNumber?: string;
    emailAddress?: string | null;
    mobileNumber?: string | null;
    taxNumber?: string | null;
    companyName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    streetName?: string | null;
    streetNumber?: string | null;
    zipCode?: string | null;
    city?: string | null;
    country?: string | null;
    region?: string | null;
    attribute1?: number | null;
    attribute2?: string | null;
    attribute3?: string | null;
    attribute4?: string | null;
    attribute5?: string | null;
}

export interface FreeFinanceInvoice {
    customer?: string;
    date?: string;
    internalDescription?: string;
    state?: string;
    referenceText?: string;
    referenceDate?: string;
    signed?: boolean;
    paymentTerm?: string;
    lines?: InvoiceItem[];
    description?: string;
    footer?: string;
    paid?: boolean;
    paidDate?: string;
}

export enum DiscountMode {
    RATE = 'RATE',
    CONSTANT = 'CONSTANT',
    CONSTANT_TOTAL = 'CONSTANT_TOTAL'
}

export interface InvoiceItem {
    item?: string;
    itemNumber?: string;
    name?: string;
    amount?: number;
    account?: string;
    taxClassEntry?: string;
    itemPrice?: number;
    itemPriceType?: string;
    netPrice?: number;
    taxPrice?: number;
    totalPrice?: number;
    discount?: number;
    discountMode?: DiscountMode;
    unitOfMeasure?: string;
}

export interface RegionResponse {
    region?: string;
    error: boolean;
}
