import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as qs from 'qs';
import moment from 'moment';

@Injectable()
export class PaymentService {
    constructor(private config: ConfigService) { }

    createVnPayUrl(req: any, orderId: number, amount: number, orderInfo: string) {
        const tmnCode = this.config.get<string>('VNP_TMN_CODE');
        const secretKey = this.config.get<string>('VNP_HASH_SECRET');
        const vnpUrl = this.config.get<string>('VNP_URL');
        const returnUrl = this.config.get<string>('VNP_RETURN_URL');

        if (!secretKey) {
            throw new Error('VNP_HASH_SECRET is not configured');
        }

        const date = new Date()
        const createDate = moment(date).format('YYYYMMDDHHmmss');

        let ipAddr = req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress;

        let vnp_Params = {};
        vnp_Params['vnp_Version'] = '2.1.0';
        vnp_Params['vnp_Command'] = 'pay';
        vnp_Params['vnp_TmnCode'] = tmnCode;
        vnp_Params['vnp_Locale'] = 'vn';
        vnp_Params['vnp_CurrCode'] = 'VND';
        vnp_Params['vnp_TxnRef'] = orderId;
        vnp_Params['vnp_OrderInfo'] = orderInfo;
        vnp_Params['vnp_OrderType'] = 'other';
        vnp_Params['vnp_Amount'] = amount * 100;
        vnp_Params['vnp_ReturnUrl'] = returnUrl;
        vnp_Params['vnp_IpAddr'] = ipAddr;
        vnp_Params['vnp_CreateDate'] = createDate;

        // sort params in a-z order
        vnp_Params = this.sortObject(vnp_Params);

        // create signature
        const signData = qs.stringify(vnp_Params, { encode: false });
        const hmac = crypto.createHmac('sha512', secretKey);
        const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

        vnp_Params['vnp_SecureHash'] = signed;

        return vnpUrl + '?' + qs.stringify(vnp_Params, { encode: false });
    }

    verifyReturnUrl(vnp_Params: any): boolean {
        const secureHash = vnp_Params['vnp_SecureHash'];
        const secretKey = this.config.get<string>('VNP_HASH_SECRET');

        if (!secretKey) {
            throw new Error('VNP_HASH_SECRET is not configured');
        }

        delete vnp_Params['vnp_SecureHash'];
        delete vnp_Params['vnp_SecureHashType'];

        const sortedParams = this.sortObject(vnp_Params);

        const signData = qs.stringify(sortedParams, { encode: false });
        const hmac = crypto.createHmac('sha512', secretKey);
        const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

        return signed === secureHash;
    }

    sortObject(obj: any): any {
        const sorted = {};
        const str: string[] = [];
        let key;

        for (key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                str.push(encodeURIComponent(key));
            }
        }

        str.sort();
        for (key = 0; key < str.length; key++) {
            const decodedKey = decodeURIComponent(str[key]);
            sorted[str[key]] = encodeURIComponent(obj[decodedKey]).replace(/%20/g, '+');
        }

        return sorted;
    }
}
