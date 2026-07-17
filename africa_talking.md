Send Bulk SMS

Send SMS through your application by making a HTTP POST request to the following endpoints:

Endpoints

Live: https://api.africastalking.com/version1/messaging/bulk

Sandbox: https://api.sandbox.africastalking.com/version1/messaging/bulk (coming soon)

Request payload

In addition to the standard request headers, this endpoint also accepts json requests. The body of the request should contain the following fields:

Field

username String Required

Your Africa’s Talking application username.

phoneNumbers String Required

A list of recipients’ phone numbers.

message String Required

The message to be sent.

senderId String Required

Your registered short code or alphanumeric

enqueue Integer Optional

This is used for Bulk SMS clients that would like to deliver as many messages to the API before waiting for an acknowledgement from the Telcos. Possible values are 1 to enable and 0 to disable. If enabled, the API will store the messages in a queue and send them out asynchronously after responding to the request. The default value is 1

API response

The body of the response will be a JSON object containing the following fields:

Field

SMSMessageData Map

A Map detailing the eventual result of the sms request. It contains the following fields:

Message String: A summary of the total number of recipients the sms was sent to and the total cost incurred.

Recipients List: A list of recipients included in the original request. Each recipient is a Map with the following fields:

statusCode Integer: This corresponds to the status of the request. Possible values are:

100: Processed

101: Sent

102: Queued

401: RiskHold

402: InvalidSenderId

403: InvalidPhoneNumber

404: UnsupportedNumberType

405: InsufficientBalance

406: UserInBlacklist

407: CouldNotRoute

409: DoNotDisturbRejection

500: InternalServerError

501: GatewayError

502: RejectedByGateway

number String: The recipient’s phone number

cost String: Amount incurred to send this sms. The format of this string is: (3-digit Currency Code)(space)(Decimal Value) e.g KES 1.00

status String: A string indicating whether the sms was sent to this recipient or not. This does not indicate the delivery status of the sms to this recipient.

messageId String: The messageId received when the sms was sent.

Send SMS to Hashed Number

For Safaricom in Kenya, you can send SMSs using hashed phone numbers to the same API endpoint.

Request payload

In addition to the standard request headers, the body of the request should contain the following fields:

Field

username String Required

Your Africa’s Talking application username.

message String Required

The message to be sent.

maskedNumber String Required

The string of the hashed number to be sent to.

telco String Required

The service provider.

phoneNumbers String Required

This value must be a blank list, i.e, []

senderId String Optional

Your registered short code or alphanumeric

API response

The body of the response will be a JSON object containing the following fields:

Field

SMSMessageData Map

A Map detailing the eventual result of the sms request. It contains the following fields:

Message String: A summary of the total number of recipients the sms was sent to and the total cost incurred.

Recipients List: A list of recipients included in the original request. Each recipient is a Map with the following fields:

statusCode Integer: This corresponds to the status of the request. Possible values are:

100: Processed

101: Sent

102: Queued

401: RiskHold

402: InvalidSenderId

403: InvalidPhoneNumber

404: UnsupportedNumberType

405: InsufficientBalance

406: UserInBlacklist

407: CouldNotRoute

409: DoNotDisturbRejection

500: InternalServerError

501: GatewayError

502: RejectedByGateway

number String: The recipient’s phone number

cost String: Amount incurred to send this sms. The format of this string is: (3-digit Currency Code)(space)(Decimal Value) e.g KES 1.00

status String: A string indicating whether the sms was sent to this recipient or not. This does not indicate the delivery status of the sms to this recipient.

messageId String: The messageId received when the sms was sent.

Curl

Copy

curl -X POST \

    https://api.africastalking.com/version1/messaging/bulk \

    -H 'Accept: application/json' \

    -H 'Content-Type: application/json' \

    -H 'apiKey: MyAppApiKey' \

    -d '{

    "username": "username",

    "message": "This is a sample message.",

    "senderId": "ABC",

    "phoneNumbers": [

        "+254711XXXYYY",

        "+254711YYYZZZ"

    ]

}'

curl -X POST \

    https://api.africastalking.com/version1/messaging/bulk \

    -H 'Accept: application/json' \

    -H 'Content-Type: application/json' \

    -H 'apiKey: MyAppApiKey' \

    -d '{

    "username": "username",

    "message": "This is a sample message.",

    "maskedNumber": "XYZ",

    "telco": "Safaricom",

    "senderId": "ABC",

    "phoneNumbers": []

}'

Example Response

{

    "SMSMessageData": {

        "Message": "Sent to 1/1 Total Cost: KES 0.8000",

        "Recipients": [{

            "statusCode": 101,

            "number": "+254711XXXYYY",

            "status": "Success",

            "cost": "KES 0.8000",

            "messageId": "ATPid_SampleTxnId123"

        }]

    }

}

, Send Bulk SMS

Send SMS through your application by making a HTTP POST request to the following endpoints:

Endpoints

Live: https://api.africastalking.com/version1/messaging

Sandbox: https://api.sandbox.africastalking.com/version1/messaging

Request payload

In addition to the standard request headers, the body of the request should contain the following fields:

Field

username String Required

Your Africa’s Talking application username.

to String Required

A comma separated string of recipients’ phone numbers.

message String Required

The message to be sent.

from String Optional

Your registered short code or alphanumeric, defaults to AFRICASTKNG.

bulkSMSMode Integer Optional

This is used by the Mobile Service Provider to determine who gets billed for a message sent using a Mobile-Terminated ShortCode. The default value is 1(which means that the sender - Africa’s Talking account being used - gets charged). This field will be ignored for messages sent using alphanumerics or Mobile-Originated shortcodes. The value must be set to 1 for bulk messages.

enqueue Integer Optional

This is used for Bulk SMS clients that would like to deliver as many messages to the API before waiting for an acknowledgement from the Telcos. Possible values are 1 to enable and 0 to disable. If enabled, the API will store the messages in a queue and send them out asynchronously after responding to the request. The default value is 1

keyword String Optional

The keyword to be used for a premium service.

linkId String Optional

This is used for premium services to send OnDemand messages. We forward the linkId to your application when the user sends a message to your service.

retryDurationInHours Integer Optional

This specifies the number of hours your subscription message should be retried in case it’s not delivered to the subscriber.

API response

The body of the response will be a JSON object containing the following fields:

Field

SMSMessageData Map

A Map detailing the eventual result of the sms request. It contains the following fields:

Message String: A summary of the total number of recipients the sms was sent to and the total cost incurred.

Recipients List: A list of recipients included in the original request. Each recipient is a Map with the following fields:

statusCode Integer: This corresponds to the status of the request. Possible values are:

100: Processed

101: Sent

102: Queued

401: RiskHold

402: InvalidSenderId

403: InvalidPhoneNumber

404: UnsupportedNumberType

405: InsufficientBalance

406: UserInBlacklist

407: CouldNotRoute

409: DoNotDisturbRejection

500: InternalServerError

501: GatewayError

502: RejectedByGateway

number String: The recipient’s phone number

cost String: Amount incurred to send this sms. The format of this string is: (3-digit Currency Code)(space)(Decimal Value) e.g KES 1.00

status String: A string indicating whether the sms was sent to this recipient or not. This does not indicate the delivery status of the sms to this recipient.

messageId String: The messageId received when the sms was sent.

For Safaricom in Kenya, you can send SMSs using hashed phone numbers to the same API endpoint.

Request payload

In addition to the standard request headers, the body of the request should contain the following fields:

Field

username String Required

Your Africa’s Talking application username.

message String Required

The message to be sent.

maskedNumber String Required

The string of the hashed number to be sent to.

telco String Required

The service provider.

senderId String Optional

Your registered short code or alphanumeric

phoneNumbers String Optional

This value must be a blank list, i.e, []

Curl

Copy

curl -X POST \

    https://api.sandbox.africastalking.com/version1/messaging \

    -H 'Accept: application/json' \

    -H 'Content-Type: application/x-www-form-urlencoded' \

    -H 'apiKey: MyAppApiKey' \

    -d 'username=MyAppUsername&to=%2B254711XXXYYY,%2B254733YYYZZZ&message=Hello%20World!&from=myShortCode'

Example Response

{

    "SMSMessageData": {

        "Message": "Sent to 1/1 Total Cost: KES 0.8000",

        "Recipients": [{

            "statusCode": 101,

            "number": "+254711XXXYYY",

            "status": "Success",

            "cost": "KES 0.8000",

            "messageId": "ATPid_SampleTxnId123"

        }]

    }

}

, Premium SMS Subscription

Subscribe to Premium SMS through your application by making a HTTP POST request to the following endpoints:

Endpoints

Live: https://content.africastalking.com/version1/subscription/safaricom

Sandbox: https://api.sandbox.africastalking.com/version1/subscription/safaricom

Online Subscription for Safaricom supports the following modes:

HE (Header Enrichment): This mode returns a URL that the content provider redirects the user to. To subscribe the user must be using safaricom mobile data for internet access. Safaricom can therefore determine which phone number it is. Once you click confirm you are subscribed and redirected back to the initial URL you submitted with your request to.

Subscribe Manage: This is a subscription mode that allows you to send a subscription request to the user via a USSD interface. The user will receive a prompt to approve or reject the subscription.

Request payload

In addition to the standard request headers, the body of the request should contain the following fields:

Field

username String Required

Your Africa’s Talking application username.

shortCode String Required

The short code to which the subscription request is sent. This should be a valid short code registered with Africa’s Talking.

keyword String

The keyword to be used for a premium service.

requestId String (optional)

This is a client specified request identifier. We add it return it as part of the http dlr callback.

redirectUrl String

This is the URL that the user will be redirected to after they have confirmed their subscription.

phoneNumber String (optional)

The phone number to which the subscription request is sent. This should be in international format, starting with a + sign followed by the country code and the phone number. For example, +254711082282.

sourceIP String

This is the IP address the subscribing party is originating from.

userAgent String

This is a string stating which browser was used to access the content.

Curl

Copy

curl --location -X POST \

    https://content.africastalking.com/version1/subscription/safaricom \

    -H 'Content-Type: application/x-www-form-urlencoded' \

    -H 'apiKey: MyAppApiKey' \

    -d 'username=testuser1' \

    -d 'shortCode=54321' \

    -d 'keyword=LOCAL' \

    -d 'requestId=requestId-15639846-7e6e-4e77-8c82-c67af8118844' \

    -d 'redirectUrl=https://africastalking.com' \

    -d 'phoneNumber=+254711082282'

Example Response

// HE (Header Enrichment) Short Code API Response:

{

    {

        "responseCode": "Success",

        "status": "Sent",

        "transactionId": "Tid_3886639048695350000",

        "url": "https://dcbatf2.safaricom.co.ke/v2/service/safaricom/bluu/Tid_177539048695398400?onError=https%3A%2F%2Fmidge-driven-flamingo.ngrok-free.app%2Fcontent%2Fpremium%2Fevina%2Fsubscription%3Ftype%3DERR%26rId%3DrequestId-9168bb62-3b6a-4a87-811d-4ef4c7e1e6dd"

         }

}

// Subscribe Manage API Response:

{    

    {

        "responseCode": "Success",

        "status": "Sent",

        "transactionId": "Tid_177539048695398400"

        }, Fetch Messages

You can incrementally fetch your application inbox. To do so, you make a HTTP GET request to the following endpoints:

Endpoints

Live: https://api.africastalking.com/version1/messaging

Sandbox: https://api.sandbox.africastalking.com/version1/messaging

Request payload

In addition to the standard request headers, the body of the request should contain the following fields:

Field

username String Required

Africa’s Talking application username.

lastReceivedId String

This is the id of the message that you last processed. The default is 0.

Preferred Method

We highly recommend configuring your application to receive messages via [notifications](/docs/notifications) instead of using the fetch messages API. This is the preferred method of receiving messages.

API Response

The body of the response will be a JSON object containing the following fields:

Field

SMSMessageData Map

A Map containing the messages from your inbox. It contains the following fields:

Messages List: A list of messages from your inbox. Each message is a Map with the following fields:

linkId String: A unique identifier attached to each incoming message.

text String:The content of the message received.

to String: Your registered short code that the sms was sent out to.

id Integer: The id of the message.

date String: The date when the sms was sent.

from String: The sender’s phone number.

Curl

Copy

curl -X GET \

    'https://api.sandbox.africastalking.com/version1/messaging?username=MyAppUsername&lastReceivedId=0' \

    -H 'Accept: application/json' \

    -H 'apiKey: MyAppApiKey'

Example Response

{

    "SMSMessageData": {

        "Messages": [{

            "linkId": "SampleLinkId123",

            "text": "Hello",

            "to": "28901",

            "id": 15071,

            "date": "2018-03-19T08:34:18.445Z",

            "from": "+254711XXXYYY"

        }]

    }

}

, SMS Notifications

The SMS API sends a notification when a specific event happens. To receive these notifications you need to setup a callback URL depending on the type of notification you would like to receive. These requests are sent as a POST request to the URL provided, as application/x-www-form-urlencoded.



Types of SMS Notifications

SMS API notifications are sent for various SMS categories as shown below:



Category

Delivery reports

Sent whenever the mobile service provider confirms or rejects delivery of a message.

Incoming messages

Sent whenever a message is sent to any of your registered shortcodes.

Bulk SMS Opt Out

Sent whenever a user opts out of receiving messages from your alphanumeric sender ID.

Subscription Notifications

Sent whenever someone subscribes or unsubscribes from any of your premium SMS products.

Delivery Reports

To receive delivery reports, you need to set a delivery report callback URL. From the dashboard select SMS -> SMS Callback URLs -> Delivery Reports.



Delivery Report notification contents



Field

id String

A unique identifier for each message. This is the same id as the one in the response when a message is sent.

status String

The status of the message. Possible values are:

Sent: The message has successfully been sent by our network.

Submitted: The message has successfully been submitted to the MSP (Mobile Service Provider).

Buffered: The message has been queued by the MSP.

Rejected: The message has been rejected by the MSP. This is a final status.

Success: The message has successfully been delivered to the receiver’s handset. This is a final status.

Failed: The message could not be delivered to the receiver’s handset. This is a final status.

AbsentSubscriber: The message was not delivered since user’s SIM card was not reachable on the network either phone was off or in a place with no network coverage.

Expired: The message was discarded by the telco as it was flagged, either some content in the message or the sender ID use was flagged on their firewall.

phoneNumber String

This is phone number that the message was sent out to.

networkCode String

A unique identifier for the telco that handled the message. Possible values are:

62120: Airtel Nigeria

62130: MTN Nigeria

62150: Glo Nigeria

62160: Etisalat Nigeria

63510: MTN Rwanda

63513: Tigo Rwanda

63514: Airtel Rwanda

63902: Safaricom

63903: Airtel Kenya

63907: Orange Kenya

63999: Equitel Kenya

64002: Tigo Tanzania

64003: Zantel Tanzania

64004: Vodacom Tanzania

64005: Airtel Tanzania

64007: TTCL Tanzania

64009: Halotel Tanzania

64101: Airtel Uganda

64110: MTN Uganda

64111: UTL Uganda

64114: Africell Uganda

65001: TNM Malawi

65010: Airtel Malawi

99999: Athena (This is a custom networkCode that only applies when working in the sandbox environment).

failureReason String Optional

Only provided if status is Rejected or Failed. Possible values are:

InsufficientCredit: This occurs when the subscriber doesn’t have enough airtime for a premium subscription service/message

InvalidLinkId: This occurs when a message is sent with an invalid linkId for an onDemand service

UserIsInactive: This occurs when the subscriber is inactive or the account deactivated by the MSP (Mobile Service Provider).

UserInBlackList: This occurs if the user has been blacklisted not to receive messages from a particular service (shortcode or keyword)

UserAccountSuspended: This occurs when the mobile subscriber has been suspended by the MSP.

NotNetworkSubcriber: This occurs when the message is passed to an MSP where the subscriber doesn’t belong.

UserNotSubscribedToProduct: This occurs when the message from a subscription product is sent to a phone number that has not subscribed to the product.

UserDoesNotExist: This occurs when the message is sent to a non-existent mobile number.

DeliveryFailure: This occurs when message delivery fails for any reason not listed above or where the MSP didn’t provide a delivery failure reason.

DoNotDisturbRejection: Note: This only applies to Nigeria. When attempting to send an SMS message with a promotional sender ID outside the allowed time window(8pm-8am), the API will return an HTTP 409 status code, indicating a conflict. This error code signifies that the request conflicts with the predefined time restrictions for promotional sender IDs by the NCC. Example Response: {"SMSMessageData":{"Message":"Sent to 0/1 Total Cost: 0","Recipients":[{"cost":"0","messageId":"None","number":"+2348XXXXXXX","status":"DoNotDisturbRejection","statusCode":409}]}}

retryCount Integer

Number of times the request to send a message to the device was retried before it succeeded or definitely failed. Note: This only applies for premium SMS messages.

Incoming Messages

To receive incoming messages, you need to set an incoming messages callback URL. From the dashboard select SMS -> SMS Callback URLs -> Incoming Messages.



Incoming message notification contents



Field

date String

The date and time when the message was received.

from String

The number that sent the message.

id String

The internal ID that we use to store this message.

linkId String Optional

Field required when responding to an on-demand user request with a premium message.

text String

The message content.

to String

The number to which the message was sent.

cost String: Amount incurred to send this sms. The format of this string is: (3-digit Currency Code)(space)(Decimal Value) e.g KES 1.00

networkCode String

A unique identifier for the telco that handled the message. Possible values are:

62120: Airtel Nigeria

62130: MTN Nigeria

62150: Glo Nigeria

62160: Etisalat Nigeria

63510: MTN Rwanda

63513: Tigo Rwanda

63514: Airtel Rwanda

63902: Safaricom

63903: Airtel Kenya

63907: Orange Kenya

63999: Equitel Kenya

64002: Tigo Tanzania

64003: Zantel Tanzania

64004: Vodacom Tanzania

64005: Airtel Tanzania

64007: TTCL Tanzania

64009: Halotel Tanzania

64101: Airtel Uganda

64110: MTN Uganda

64111: UTL Uganda

64114: Africell Uganda

65001: TNM Malawi

65010: Airtel Malawi

99999: Athena (This is a custom networkCode that only applies when working in the sandbox environment).

Bulk SMS Opt Out

To receive bulk sms opt out notifications, you need to set a bulk sms opt out callback URL. From the dashboard select SMS -> SMS Callback URLs -> Bulk SMS Opt Out.



The instructions on how to opt out are automatically appended to the first message you send to the mobile subscriber. From then onwards, any other message will be sent ‘as is’ to the subscriber.



Bulk sms opt out notification contents



Field

senderId String

This is the shortcode/alphanumeric sender id the user opted out from.

phoneNumber String

This will contain the phone number of the subscriber who opted out.

Subscription Notification

To receive premium sms subscription notifications, you need to set a subscription notification callback URL. From the dashboard select SMS -> SMS Callback URLs -> Subscription Notifications.



Subscription notification contents



Field

phoneNumber String

Phone number to subscribe or unsubscribe.

shortCode String

The short code that has this product.

keyword String

The keyword of the product that the user has subscribed or unsubscribed from.

updateType String

The type of the update. The value could either be addition or deletion.



}
Application Data
Initiate an application data request by making a HTTP GET request to the following endpoint:

Endpoints
Live: https://api.africastalking.com/version1/user
Sandbox: https://api.sandbox.africastalking.com/version1/user
The standard request headers are required when making this request.

API response
The body of the response will be a JSON object containing the following fields:

Field
UserData Map
A map which contains the application data.
UserData Map
balance String: Your Africa’s Talking application balance. The format of this string is: (3-digit Currency Code)(space)(Decimal Value) e.g KES 1785.50

Curl
Copy
curl -X GET \
    https://api.sandbox.africastalking.com/version1/user?username=MyAppUsername \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -H 'apiKey: MyAppApiKey'
Example Response
{
    "userData": {
        "balance": "KES 1785.50"
    }
}

