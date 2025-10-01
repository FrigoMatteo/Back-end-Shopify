const get_orders= async (client,user)=>{
  console.log(user) // Value to insert inside the "search"

  try{
    
    const QUERY = `
      query getDraftOrders( $first: Int!) {
        draftOrders(first: $first, reverse: true) {
          edges {
            node {
              id
              name
              status
              tags
            }
          }
        }
      }
    `;

    const response = await client.request(QUERY, {
      variables: {first: 20 }
      //variables: { search: user, first: 50 }
    });
    return response.data;

  }catch(err){
    console.log(err)
    return {error:"Cannot retrieve pre-orders"};
  }

}

/*
const QUERY = `
      query getDraftOrders($search: String!, $first: Int!) {
        draftOrders(first: $first, query: $search) {
          edges {
            node {
              id
              name
              status
              tags
              customer {
                id
                displayName
                email
              }
            }
          }
        }
      }
    `;
*/


const get_products= async (client)=>{
  
  try{
    
    const QUERY = `
      query products( $first: Int!) {
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
            images(first: 1) { 
              nodes {
                originalSrc      
                altText
              }
            }
          }
        }
      }
    `;

    const response = await client.request(QUERY, {
      variables: {first: 250 }
    });
    return response.data;

  }catch(err){
    console.log(err)
    return {error:"Cannot retrieve pre-orders"};
  }

}






const get_ordersId= async (client,user,orderId)=>{
  console.log(user) // Value to insert inside the "search"

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


module.exports = {get_products,get_orders,get_ordersId};