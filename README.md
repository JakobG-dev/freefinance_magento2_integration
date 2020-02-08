# FreeFinance Magento 2 Order Integration

This Integration can be used to connect Magento 2 to FreeFinance API. This Code will create an FreeFinance Invoice whenever an order is placed in Magento.

This is **not** an official FreeFinance integraion! **No** guarantee for functionality or security!

This integration was built with Google Firebase and Google Cloud Platform. For this integration to work **you need Firebase "Blaze Plan"** not "Spark Plan".

This Integration uses FreeFinance [Authorization code flow](https://developer.freefinance.at/apidoc-1_1.html#_authorization_code_flow)

Used Tech-Stack:

-   Typescript
-   Firebase Cloud Funcitons
-   Firebase Realtime Database
-   GCP PubSub

## Setup Steps:

**Step 1:**
Create an Integration in Magento Admin Dashboard to get Magento Access Token.
System > Extensions > Integration > Add New Integration

**Step 2:**
Create a Firebase Project.
[https://firebase.google.com/docs/functions/get-started](https://firebase.google.com/docs/functions/get-started)

**Step 3:**
Copy this repo in you functions folder of your firebase project.

**Step 4:**
Create a PubSub Topic in the Google Cloud Platform Project associated to your Firebase project.

**Step 5:**
Set Environment Variables in your Firebase Project with Firebase CLI.
[https://firebase.google.com/docs/functions/config-env](https://firebase.google.com/docs/functions/config-env)
Set following Variables:

    {
      "gcp": {
        "topic_name": "Your PubSub Topic name",
        "project_id": "Your GCP ProjectID"
      },
      "magento": {
        "access_token": "Your Access Token to Magento API",
        "url": "Your Magento Shop URL"
      },
      "freefinance": {
        "url": "https://app.freefinance.at",
        "state": "Choose any string",
        "client_secret": "Your FreeFinance client secret",
        "client_id": "Your FreeFinance client id"
      }
    }

**Step 6:**
Setup Payment Mapping.
Copy src/configurationTemplate.json and rename to configuration.json
Change Keys to your Magento Payment Methods. Set string value to the corresponding FreeFinance Payment Method ID.
You can fetch them from this API endpoint:
[https://developer.freefinance.at/apidoc-1_1.html#\_getallpaymentterms](https://developer.freefinance.at/apidoc-1_1.html#_getallpaymentterms)
You can make request easily using Postman. You can find access token in Firebase Realtime Database after you authenticated as described below.

**Step 7:**
Deploy to Firebase.

**Step 8:**
Your Auth Redirect URL will be:
{{Your Firebase Function URL}}/freefinanceauth
Send it to the Freefinance Team.

## How to use this Integration:

**Call this URL to Authenticate:**
https://app.freefinance.at/oauth2/auth?client_id={{ Your client_id }}&response_type=code&redirect_uri={{Your Firebase Function URL}}/freefinanceauth&state={{ Your state }}

After Signing In it will redirect to your Auth Firebase Cloud Function:
{{Your Firebase Function URL}}/freefinanceauth

This cloud function will store the access and refresh token in Firebase Realtime Database. This Token will be valid for 1 Month. Whenever a new order comes in it will be extendet to another month. If you don't have an order within 1 month you might have to call the Auth URL again.

**Create Invoice:**
Now you can create a request to following URL to create an Invoice in FreeFinance:
{{Your Firebase Function URL}}/createfreefinanceinvoice?state={{Your state string from env variables}}&entity_id={{ magento 2 order entity_id }}
You can also provide increment_id instead of entity_id.

**What this will do:**

1.  It will refresh the FreeFinance Access Token.
2.  It will log the Request to Firebase Realtime Database
3.  It will create a message in PubSub Topic, that an order is created
4.  Another cloud function listening to this topic will be triggered
5.  This function fetches the order data from Magento API
6.  It checks if customer already exists in FreeFinance, If not it will create an new one
7.  It will create Invoice for this
    customer in FreeFinance

Now you can use a Magento Webhook extension like this free one:
https://www.mageplaza.com/magento-2-webhook/

This can be used to create a Request to Invoice Creation URL whenever an Order is created in Magento.

## Troubleshooting:

Check out the Firebase Cloud Function Log for detailed reporting.

## Known Issues:

While loop in index.js should be removed or optemized
