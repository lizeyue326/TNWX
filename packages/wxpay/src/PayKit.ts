import { RequestMethod } from './RequestMethod'
import { Kits, HttpKit } from '@tnwx/kits'
import * as urlencode from 'urlencode'
import * as os from 'os'
import * as util from 'util'

/**
 * @author Javen
 * @copyright javendev@126.com
 * @description 微信支付工具类
 */
export class PayKit {
  /**
   * 验证签名
   * @param signature   待验证的签名
   * @param body        应答主体
   * @param nonce       随机串
   * @param timestamp   时间戳
   * @param publicKey   平台公钥
   */
  public static verifySignature(signature: string, body: string, nonce: string, timestamp: string, publicKey: Buffer): boolean {
    let buildSignMessage: string = this.buildRepSignMessage(timestamp, nonce, body)
    return Kits.sha256WithRsaVerify(publicKey, signature, buildSignMessage)
  }

  /**
   * 验证签名
   * @param headers     http 请求头
   * @param body        应答主体
   * @param publicKey   平台公钥
   */
  public static verifySign(headers: any, body: string, publicKey: Buffer): boolean {
    let timestamp = headers['wechatpay-timestamp']
    let nonce = headers['wechatpay-nonce']
    let signature = headers['wechatpay-signature']
    let buildSignMessage: string = this.buildRepSignMessage(timestamp, nonce, body)
    return Kits.sha256WithRsaVerify(publicKey, signature, buildSignMessage)
  }

  /**
   * 证书和回调报文解密
   * @param key             apiKey3
   * @param nonce           加密使用的随机串初始化向量
   * @param associatedData  附加数据包
   * @param ciphertext      密文
   */
  public static aes256gcmDecrypt(key: string, nonce: string, associatedData: string, ciphertext: string) {
    return Kits.aes256gcmDecrypt(key, nonce, associatedData, ciphertext)
  }
  /**
   * SHA256 with RSA 加密生成签名
   * @param key key.pem 证书 key
   * @param data 待签名串
   */
  public static sha256WithRsa(key: Buffer, data: string): string {
    return Kits.sha256WithRsa(data, key)
  }

  /**
   * 构建请求签名参数
   * @param method {RequestMethod} Http 请求方式
   * @param url 请求接口 /v3/certificates
   * @param timestamp 获取发起请求时的系统当前时间戳
   * @param nonceStr 随机字符串
   * @param body 请求报文主体
   */
  public static buildReqSignMessage(method: RequestMethod, url: string, timestamp: string, nonceStr: string, body: string): string {
    return method
      .concat('\n')
      .concat(url)
      .concat('\n')
      .concat(timestamp)
      .concat('\n')
      .concat(nonceStr)
      .concat('\n')
      .concat(body)
      .concat('\n')
  }

  /**
   * 构建应答签名参数
   * @param timestamp 应答时间戳
   * @param nonceStr 应答随机串
   * @param body 应答报文主体
   */
  public static buildRepSignMessage(timestamp: string, nonceStr: string, body: string): string {
    return timestamp
      .concat('\n')
      .concat(nonceStr)
      .concat('\n')
      .concat(body)
      .concat('\n')
  }

  /**
   * 拼接参数
   * @param map     待拼接的 Map 数据
   * @param connStr 连接符
   * @param encode  是否 urlencode
   * @param quotes  是否 ""
   */
  public static createLinkString(map: Map<string, string>, connStr: string, encode: boolean, quotes: boolean): string {
    // 排序
    let arrayObj = Array.from(map)
    arrayObj.sort((a: any, b: any) => {
      return a[0].localeCompare(b[0])
    })
    let content: string = ''
    for (let i = 0; i < arrayObj.length; i++) {
      let key = arrayObj[i][0]
      let value = arrayObj[i][1]
      // 拼接时，不包括最后一个&字符
      if (i == arrayObj.length - 1) {
        if (quotes) {
          content = content
            .concat(key)
            .concat('=')
            .concat('"')
            .concat(encode ? urlencode.encode(value) : value)
            .concat('"')
        } else {
          content = content
            .concat(key)
            .concat('=')
            .concat(encode ? urlencode.encode(value) : value)
        }
      } else {
        if (quotes) {
          content = content
            .concat(key)
            .concat('=')
            .concat('"')
            .concat(encode ? urlencode.encode(value) : value)
            .concat('"')
            .concat(connStr)
        } else {
          content = content
            .concat(key)
            .concat('=')
            .concat(encode ? urlencode.encode(value) : value)
            .concat(connStr)
        }
      }
    }
    return content
  }

  /**
   * 获取授权认证信息
   *
   * @param mchId     商户号
   * @param serialNo  商户API证书序列号
   * @param nonceStr  请求随机串
   * @param timestamp 时间戳
   * @param signature 签名值
   * @param authType  认证类型，目前为WECHATPAY2-SHA256-RSA2048
   */
  public static getAuthorization(mchId: string, serialNo: string, nonceStr: string, timestamp: string, signature: string, authType: string): string {
    let map: Map<string, string> = new Map()
    map.set('mchid', mchId)
    map.set('serial_no', serialNo)
    map.set('nonce_str', nonceStr)
    map.set('timestamp', timestamp)
    map.set('signature', signature)
    return authType.concat(' ').concat(this.createLinkString(map, ',', false, true))
  }

  /**
   * 构建 v3 接口所需的 Authorization
   *
   * @param method    {RequestMethod} 请求方法
   * @param urlSuffix 可通过 WxApiType 来获取，URL挂载参数需要自行拼接
   * @param mchId     商户Id
   * @param serialNo  商户 API 证书序列号
   * @param key       key.pem 证书
   * @param body      接口请求参数
   */
  public static async buildAuthorization(method: RequestMethod, urlSuffix: string, mchId: string, serialNo: string, key: Buffer, body: string): Promise<string> {
    let timestamp: string = parseInt((Date.now() / 1000).toString()).toString()

    let authType: string = 'WECHATPAY2-SHA256-RSA2048'
    let nonceStr: string = Kits.generateStr()

    // 构建签名参数
    let buildSignMessage: string = this.buildReqSignMessage(method, urlSuffix, timestamp, nonceStr, body)
    // 生成签名
    let signature: string = this.sha256WithRsa(key, buildSignMessage)
    // 根据平台规则生成请求头 authorization
    return this.getAuthorization(mchId, serialNo, nonceStr, timestamp, signature, authType)
  }

  /**
   * 微信支付 Api-v3 get 请求
   * @param urlPrefix     请求接口前缀，可通过 WxDmainType 来获取
   * @param urlSuffix     请求接口后缀，可通过 WxApiType 来获取
   * @param mchId         商户号
   * @param serialNo      证书序列号
   * @param key           key.pem 证书
   * @param params        请求参数
   * @param platSerialNo  微信平台序列号
   */
  public static async exeGet(
    urlPrefix: string,
    urlSuffix: string,
    mchId: string,
    serialNo: string,
    key: Buffer,
    params?: Map<string, string>,
    platSerialNo?: string
  ): Promise<any> {
    if (params && params.size > 0) {
      urlSuffix = urlSuffix.concat('?').concat(this.createLinkString(params, '&', true, false))
    }
    let authorization = await this.buildAuthorization(RequestMethod.GET, urlSuffix, mchId, serialNo, key, '')
    return await this.get(urlPrefix.concat(urlSuffix), authorization, platSerialNo || serialNo)
  }

  /**
   * 微信支付 Api-v3 post 请求
   * @param urlPrefix     请求接口前缀，可通过 WxDmainType 来获取
   * @param urlSuffix     请求接口后缀，可通过 WxApiType 来获取
   * @param mchId         商户号
   * @param serialNo      证书序列号
   * @param key           key.pem 证书
   * @param data          接口请求参数
   * @param platSerialNo  微信平台序列号
   */
  public static async exePost(urlPrefix: string, urlSuffix: string, mchId: string, serialNo: string, key: Buffer, data: string, platSerialNo?: string): Promise<any> {
    let authorization = await this.buildAuthorization(RequestMethod.POST, urlSuffix, mchId, serialNo, key, data)
    return await this.post(urlPrefix.concat(urlSuffix), data, authorization, platSerialNo || serialNo)
  }

  /**
   * 微信支付 Api-v3 delete 请求
   * @param urlPrefix     请求接口前缀，可通过 WxDmainType 来获取
   * @param urlSuffix     请求接口后缀，可通过 WxApiType 来获取
   * @param mchId         商户号
   * @param serialNo      证书序列号
   * @param key           key.pem 证书
   * @param platSerialNo  微信平台序列号
   */
  public static async exeDelete(urlPrefix: string, urlSuffix: string, mchId: string, serialNo: string, key: Buffer, platSerialNo?: string): Promise<any> {
    let authorization = await this.buildAuthorization(RequestMethod.DELETE, urlSuffix, mchId, serialNo, key, '')
    return await this.delete(urlPrefix.concat(urlSuffix), authorization, platSerialNo || serialNo)
  }

  /**
   * 微信支付 Api-v3 upload 请求
   * @param urlPrefix     请求接口前缀，可通过 WxDmainType 来获取
   * @param urlSuffix     请求接口后缀，可通过 WxApiType 来获取
   * @param mchId         商户号
   * @param serialNo      证书序列号
   * @param key           key.pem 证书
   * @param filePath      需要上传的文件路径
   * @param data          请求参数
   * @param platSerialNo  微信平台序列号
   */
  public static async exeUpload(
    urlPrefix: string,
    urlSuffix: string,
    mchId: string,
    serialNo: string,
    key: Buffer,
    filePath: string,
    data: string,
    platSerialNo?: string
  ): Promise<any> {
    let authorization = await this.buildAuthorization(RequestMethod.UPLOAD, urlSuffix, mchId, serialNo, key, data)
    return await this.upload(urlPrefix.concat(urlSuffix), filePath, data, authorization, platSerialNo || serialNo)
  }

  /**
   * get 方法
   * @param url           请求 url
   * @param authorization 授权信息
   * @param serialNumber  证书序列号
   */
  public static async get(url: string, authorization: string, serialNumber?: string) {
    return await HttpKit.getHttpDelegate.httpGetToResponse(url, {
      headers: this.getHeaders(authorization, serialNumber)
    })
  }

  /**
   * post 方法
   * @param url           请求 url
   * @param authorization 授权信息
   * @param serialNumber  证书序列号
   */
  public static async post(url: string, data: string, authorization: string, serialNumber?: string) {
    return await HttpKit.getHttpDelegate.httpPostToResponse(url, data, {
      headers: this.getHeaders(authorization, serialNumber)
    })
  }

  /**
   * delete 方法
   * @param url           请求 url
   * @param authorization 授权信息
   * @param serialNumber  证书序列号
   */
  public static async delete(url: string, authorization: string, serialNumber?: string) {
    return await HttpKit.getHttpDelegate.httpDeleteToResponse(url, {
      headers: this.getHeaders(authorization, serialNumber)
    })
  }

  /**
   * upload 方法
   * @param url           请求 url
   * @param filePath      文件路径
   * @param data          请求数据
   * @param authorization 授权信息
   * @param serialNumber  证书序列号
   */
  public static async upload(url: string, filePath: string, data: string, authorization: string, serialNumber?: string) {
    let headers = this.getHeaders(authorization, serialNumber)
    headers['Content-type'] = 'multipart/form-data'
    return await HttpKit.getHttpDelegate.uploadToResponse(url, filePath, data, {
      headers
    })
  }

  /**
   * 获取请求头
   * @param authorization 授权信息
   * @param serialNumber  证书序列号
   */
  private static getHeaders(authorization: string, serialNumber: string): Object {
    let userAgent: string = 'WeChatPay-TNWX-HttpClient/%s (%s) nodejs/%s'
    userAgent = util.format(
      userAgent,
      '2.4.0',
      os
        .platform()
        .concat('/')
        .concat(os.release()),
      process.version
    )
    return {
      Authorization: authorization,
      Accept: 'application/json',
      'Content-type': 'application/json',
      'Wechatpay-Serial': serialNumber,
      'User-Agent': userAgent
    }
  }
}
