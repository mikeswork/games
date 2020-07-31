const axios = require("axios");
const constants = require("../constants");
const session = require("./session");

module.exports = {
    loadProduct(handlerInput) {
        const locale = handlerInput.requestEnvelope.request.locale;
        const ms = handlerInput.serviceClientFactory.getMonetizationServiceClient();
        const prevProduct = session.getAttributes(handlerInput, "availableProduct");

        return ms
            .getInSkillProducts(locale)
            .then(
                function addProductToAttributes(result) {
                    const allProducts = result.inSkillProducts;

                    if (allProducts && allProducts.length > 0) {
                        return allProducts[0];
                    }
                },
                function addProductToAttributesError(err) {
                    console.log(`Error calling InSkillProducts API: ${err}`);
                }
            )
            .then(async product => {
                session.setAttributes(handlerInput, { availableProduct: product });

                const isPurchasingOn = await this.loadIsPurchasingOn(handlerInput);

                // We only care about purchase status if Mega Pack is not already available
                if (!this.isPremiumExperience(handlerInput) && isPurchasingOn) {
                    await this.loadPurchaseStatus(handlerInput);
                }

                // Determine if product is newly bought in case we want to test for this and then congratulate user
                const productJustBought =
                    prevProduct !== undefined &&
                    prevProduct.entitled === "NOT_ENTITLED" &&
                    product !== undefined &&
                    product.entitled === "ENTITLED" &&
                    product.entitlementReason !== 'AUTO_ENTITLED';
                return productJustBought;
            });
    },

    loadIsPurchasingOn(handlerInput) {
        const System = handlerInput.requestEnvelope.context.System;

        // Take the part that comes after 'https://'
        const hostHeader = System.apiEndpoint.split("://").pop();
        console.log("hostHeader:", hostHeader);
        console.log(
            `Axios GET ${System.apiEndpoint}/v1/users/~current/skills/~current/settings/voicePurchasing.enabled`
        );

        return axios
            .get(`${System.apiEndpoint}/v1/users/~current/skills/~current/settings/voicePurchasing.enabled`, {
                headers: {
                    Host: hostHeader,
                    Authorization: `Bearer ${System.apiAccessToken}`,
                    "Accept-Language": handlerInput.requestEnvelope.request.locale
                }
            })
            .then(function(response) {
                // handle success
                console.log("Axios Response Data:", response.data);
                session.setAttributes(handlerInput, { isPurchasingOn: response.data });

                return response.data;
            })
            .catch(function(error) {
                // handle error
                console.log("Axios Error:", error);
                session.setAttributes(handlerInput, { isPurchasingOn: false });
                return false;
            });
    },

    // The inSkillProductsTransactions API let's us check the
    // kid monetization purchase status on a product (i.e. Mega Pack).
    loadPurchaseStatus(handlerInput) {
        const System = handlerInput.requestEnvelope.context.System;

        // Take the part that comes after 'https://'
        const hostHeader = System.apiEndpoint.split("://").pop();

        return axios
            .get(`${System.apiEndpoint}/v1/users/~current/skills/~current/inSkillProductsTransactions`, {
                headers: {
                    Host: hostHeader,
                    Authorization: `Bearer ${System.apiAccessToken}`,
                    "Accept-Language": handlerInput.requestEnvelope.request.locale
                }
            })
            .then(function(response) {
                // handle success
                console.log("Axios Response Data:", response.data);

                const tData = response.data;
                if (tData["results"]) {
                    const tLatest = tData.results[0];
                    if (tLatest) {
                        session.setAttributes(handlerInput, {
                            purchaseTransaction: {
                                status: tLatest.status,
                                timeUpdated: new Date(tLatest.lastModifiedTime).getTime()
                            }
                        });
                    }
                }
            })
            .catch(function(error) {
                // handle error
                console.log("Axios Error:", error);
            });
    },

    isPurchasingOn(handlerInput) {
        const isPurchasingOn = session.getAttributes(handlerInput, "isPurchasingOn");
        return isPurchasingOn;
    },

    isProductPurchased(handlerInput) {
        const p = session.getAttributes(handlerInput, "availableProduct");

        return p !== undefined && 
               p.entitled === "ENTITLED" && 
               p.entitlementReason === "PURCHASED";
    },

    isFTU(handlerInput) {
        const p = session.getAttributes(handlerInput, "availableProduct");

        return (
            p !== undefined &&
            p.entitled === "ENTITLED" &&
            p.entitlementReason === "AUTO_ENTITLED"
        );
    },

    isPremiumExperience(handlerInput) {
        return this.isProductPurchased(handlerInput) || this.isFTU(handlerInput);
    },

    isPendingPermission(handlerInput) {
        const pTransact = session.getAttributes(handlerInput, "purchaseTransaction");
        const product = session.getAttributes(handlerInput, "availableProduct");
        console.log("[isPendingPermission][pTransact]", pTransact);

        return (
            product !== undefined &&
            product.entitled === "NOT_ENTITLED" &&
            product.purchasable === "NOT_PURCHASABLE" &&
            pTransact !== undefined &&
            pTransact.status === "PENDING_APPROVAL_BY_PARENT"
        );
    },

    expiredOrDeclined(handlerInput) {
        const pTransact = session.getAttributes(handlerInput, "purchaseTransaction");
        const product = session.getAttributes(handlerInput, "availableProduct");

        if (product !== undefined && product.entitled === "NOT_ENTITLED") {
            if (
                pTransact !== undefined &&
                (pTransact.status === "EXPIRED_NO_ACTION_BY_PARENT" || pTransact.status === "DENIED_BY_PARENT")
            ) {
                const now = Date.now(); // Used to determine if the expiration/declining itself expired
                return now - pTransact.timeUpdated < constants.DECLINED_PURCHASE_TIMEOUT;
            } else {
                return false;
            }
        } else {
            return false;
        }
    },

    upsellConditionsMet(handlerInput) {
        return (
            this.isPurchasingOn(handlerInput) &&
            !this.isProductPurchased(handlerInput) &&
            !this.isFTU(handlerInput) &&
            !this.isPendingPermission(handlerInput) &&
            !this.expiredOrDeclined(handlerInput)
        );
    }
};
