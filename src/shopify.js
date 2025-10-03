let totalQueryCost = 0;

const get_Cost_per_call = (response) => {
  if (response.extensions && response.extensions.cost) {
    const cost = response.extensions.cost;

    /*
    console.log("Requested Query Cost:", cost.requestedQueryCost);
    console.log("Actual Query Cost:", cost.actualQueryCost);
    console.log("Throttle Status:", cost.throttleStatus);
    console.log(`Currently Available: ${cost.throttleStatus.currentlyAvailable}`);
    console.log(`Maximum Available: ${cost.throttleStatus.maximumAvailable}`);
    console.log(`Restore Rate: ${cost.throttleStatus.restoreRate} per second`);
    */

    // Aggiorno il totale accumulato
    totalQueryCost += cost.actualQueryCost;

    console.log(`Costo totale accumulato fino ad ora: ${totalQueryCost}`);
  } else {
    console.log("Nessuna informazione sul costo trovata.");
  }
};


const get_orders= async (client,user)=>{
  // Value to insert inside the "search"

  try{
    
    const QUERY = `
      query getDraftOrders($first: Int!) {
        draftOrders(first: $first, reverse: true) {
          edges {
            node {
              id
              name
              status
              tags
              createdAt
              customer {
                id
                displayName
                email
                phone
              }

              lineItems(first: 20) {
                edges {
                  node {
                    id
                    quantity
                    originalUnitPriceSet {
                      shopMoney {
                        amount
                      }
                    }
                    title
                    variant {
                      id
                      title
                      product {
                        id
                        title
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    const response = await client.request(QUERY, {
      variables: {first: 20 }
      //variables: { search: user, first: 50 }
    });

    get_Cost_per_call(response)
    return response.data;

  }catch(err){
    console.log(err)
    return {error:"Cannot retrieve pre-orders"};
  }

}


const create_clients = async (client, createClient) => {
  try {
    const mutation = `
      mutation customerCreate($input: CustomerInput!) {
        customerCreate(input: $input) {
          userErrors {
            field
            message
          }
          customer {
            id
            email
            phone
            taxExempt
            firstName
            lastName
            amountSpent {
              amount
              currencyCode
            }
            smsMarketingConsent {
              marketingState
              marketingOptInLevel
              consentUpdatedAt
            }
          }
        }
      }`;

    const variables = {
      input: {
        email: "steve.lastnameson@example.com",
        phone: "+16465555555",
        firstName: "Steve",
        smsMarketingConsent: {
          marketingState: "SUBSCRIBED",
          marketingOptInLevel: "SINGLE_OPT_IN"
        }
      }
    };

    const response = await client.request(mutation, { variables });

    return response.customerCreate;

  } catch (err) {
    console.log(err);
    return { error: "Cannot create client" };
  }
};


const get_clients=async(client)=>{
  try{
    const QUERY =
    `query CustomerList($first: Int!, $after: String) {
    customers(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          displayName
          defaultEmailAddress {
            emailAddress
          }
          verifiedEmail
          defaultAddress {
            id
            address1
            city
            province
            country
            zip
            phone
            provinceCode
            countryCodeV2
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }`;

  let hasNextPage = true;
  let after = undefined;
  let allCustomers = [];

  while (hasNextPage) {
    const response = await client.request(QUERY, {
      variables: { first: 250, after }
    });

    get_Cost_per_call(response)

    const { edges, pageInfo } = response.data.customers;
    if (!edges || edges.length === 0) break;

    allCustomers.push(...edges.map(edge => edge.node));

    hasNextPage = pageInfo.hasNextPage;
    after = pageInfo.endCursor;
  }

  return allCustomers;

  }catch(err){
    console.log(err)
    return {error:"Cannot get clients"}
  }
}

// --------------------------------------------------------------------------------------------------------------------
// Consideriamo solo una viriante per prodotto, non multipli a prodotto
// --------------------------------------------------------------------------------------------------------------------
const get_products= async (client)=>{
  
  try{
    
    const QUERY = `
      query products($first: Int!) {
        products(first: $first, reverse: true) {
          nodes {
            id
            title
            status

            variants(first: 1) {
              nodes {
                id
                inventoryQuantity
                price
              }
            }

            media(first: 1) {
              nodes {
                preview {
                  image {
                    url
                  }
                } 
              }
            }
          }
        }
      }
    `;

    const response = await client.request(QUERY, {
      variables: {first: 250 }
    });

    get_Cost_per_call(response)

    return response.data;

  }catch(err){
    console.log(err)
    return {error:"Cannot retrieve pre-orders"};
  }

}






const get_ordersId= async (client,user,orderId)=>{
  // Value to insert inside the "search"

  try{
    
    const QUERY = `
      query getDraftOrder($id: ID!) {
        draftOrder(id: $id) {
          id
          name
          status
          createdAt
          tags
          email
          invoiceUrl
          totalPrice
          subtotalPrice
          completedAt


          billingAddress {
            address1
            address2
            city
            country
            zip
            province
            firstName
            lastName
          }

          shippingAddress {
            address1
            address2
            city
            country
            zip
            province
            firstName
            lastName
          }

          lineItems(first: 50) {
            edges {
              node {
                id
                title
                name
                quantity
                originalUnitPrice
                appliedDiscount {
                  amount
                  description
                  title
                  value
                  valueType
                }
                variant {
                  id
                  title
                  sku
                  price
                  product {
                    id
                    title
                    handle
                  }
                }
              }
            }
          }
        }
      }
    `;

    // Check user tag that matches with the Call center that created that pre-order
    const response = await client.request(QUERY, {
      variables: { 
        id: `gid://shopify/DraftOrder/${orderId}`,
        //search: user
      }
    });

    return new Promise((resolve,reject)=>{
      return resolve(response.data);
    });
    }catch(err){
      return new Promise((resolve,reject)=>{
        console.log(err)
        return reject({error:"Cannot retrieve pre-order"});
      });
    }

}



// Test vari:
const test_insert= async ()=>{
  const data = await client.query({
    data: {
      "query": `mutation draftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
          }
        }
      }`,
      "variables": {
          "input": {
              "note": "Test draft order",
              "email": "test.user@shopify.com",
              "taxExempt": true,
              "tags": [
                  "foo",
                  "App-Dev"
              ],
              "shippingAddress": {
                  "address1": "123 Main St",
                  "city": "Waterloo",
                  "province": "Ontario",
                  "country": "Canada",
                  "zip": "A1A 1A1"
              },
              "billingAddress": {
                  "address1": "456 Main St",
                  "city": "Toronto",
                  "province": "Ontario",
                  "country": "Canada",
                  "zip": "Z9Z 9Z9"
              },
              "lineItems": [
                  {
                      "variantId": "gid://shopify/ProductVariant/53269203452227",
                      "quantity": 2
                  }
              ],
          }
      },
    },
  });

  // 2️⃣ Controllo errori generali GraphQL
  if (data.body.errors) {
    console.log("GraphQL errors:");
    console.log(response.body.errors);
  }
  console.log(JSON.stringify(data.body.data, null, 2));
}


module.exports = {get_products,get_orders,get_ordersId, get_clients};