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


const create_clients = async (client, createClient,user) => {
  try {
    if (!user){
      return {error:"Problema con sessione. Contatta l'amministratore"};
    }

    const CUSTOMER_SEARCH = `
      query customerByEmail($query: String!) {
        customers(first: 1, query: $query) {
          edges {
            node {
              id
              email
              firstName
              lastName
            }
          }
        }
      }
      `;

    const check = await client.request(CUSTOMER_SEARCH, {
      variables: { query: `email:${createClient.email}`}
    });

    const existingCustomer = check.data.customers.edges[0]?.node;

    if (existingCustomer) {
      return {error:"Cliente già esistente"}
    }


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
            firstName
            lastName
            note 
            addresses {
              id
              address1
              city
              zip
              province
              country
            }
          }
        }
      }
    `;

    // Phone number ex:"+39333111222"
    // country example: "IT"

    const variables = {
      input: {
        firstName: createClient.name,
        lastName: createClient.surname,
        email: createClient.email,
        phone: createClient.phone,
        tags: ["TEST DEVELOPMENT",user],
        note:`Creato attraverso API dall'utente - ${user}`,
        addresses: [
          {
            firstName: createClient.name,
            lastName: createClient.surname,
            company: createClient.company,
            address1: createClient.address,
            address2: createClient.fiscalCode,
            city: createClient.city,
            province: createClient.province,
            zip: createClient.postalCode,
            country: createClient.country,
            phone: createClient.phone
          }
        ]
      }
    };

    return {error:"Blocked"}

    const response = await client.request(mutation, { variables });

    if (response.data.customerCreate.userErrors.length > 0) {
      console.log("Errori:", response.data.customerCreate.userErrors);
      return { error: "Errore compilazione dati. Se persiste contattare amministratore" };
    }
    console.log(response.data.customerCreate)

    get_Cost_per_call(response)
    return response.data.customerCreate.customer;

  } catch (err) {
    console.log(err);
    return { error: "Cannot create client" };
  }
};


const get_clients=async(client)=>{
  try{
    const QUERY =
    `query CustomerList($first: Int!, $after: String) {
    customers(first: $first, after: $after,reverse: true) {
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
            address2
            company
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



// Create draftOrder
const create_order= async (client, draftOrder,user)=>{
  try {
    const MUTATION = `
      mutation draftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          userErrors {
            field
            message
          }
          draftOrder {
            id
            name
            invoiceUrl
            createdAt
            customer {
              id
              email
              firstName
              lastName
            }
            shippingAddress {
              firstName
              lastName
              company
              address1
              address2
              city
              province
              zip
              country
              phone
            }
            lineItems(first: 50) {
              nodes {
                title
                quantity
                originalUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                appliedDiscount {    
                  title
                  value
                  valueType
                  amountV2 {
                    amount
                    currencyCode
                  }
                }
              }
            }
            appliedDiscount {
              title
              value
              valueType
            }
          }
        }
      }
    `;
    // Example customerId:"gid://shopify/Customer/23298585035075"
    
    const variables = {
      input: {
        customerId: draftOrder.customer.customerId, // ID cliente Shopify
        note: `Creato attraverso API dall'utente - ${user}`,
        tags: ["TEST-DEVELOPMENT",user],

        // 🔹 Line items: prodotti o articoli personalizzati
        lineItems:draftOrder.products ,
        shippingAddress: {
          firstName: draftOrder.customer.name,
          lastName: draftOrder.customer.surname,
          company: draftOrder.customer.company,
          address1: draftOrder.customer.address,
          address2: draftOrder.customer.fiscalCode,
          city: draftOrder.customer.city,
          province: draftOrder.customer.province,
          zip: draftOrder.customer.postalCode,
          country: draftOrder.customer.country,
          phone: draftOrder.customer.phone
        },

        appliedDiscount: {
          title: draftOrder.globalDiscount.title,
          value: draftOrder.globalDiscount.value,
          valueType: draftOrder.globalDiscount.valueType,
        },

        presentmentCurrencyCode: "EUR"
      }
    };
    // valueType: "PERCENTAGE" // oppure "FIXED_AMOUNT"

    console.log(variables)
    return {Test:"TEST TTT"}
    const response = await client.request(MUTATION, { variables });

    if (response.data.draftOrderCreate.userErrors.length > 0) {
      console.log("Errori:", response.data.draftOrderCreate.userErrors);
      return { error: "Errore nella creazione dell'ordine" };
    }

    get_Cost_per_call(response);

    return response.data.draftOrderCreate.draftOrder;

  } catch (err) {
    console.log(err);
    return { error: "Cannot create draftOrder" };
  }
    /*
    lineItems: [
      {
        variantId: "gid://shopify/ProductVariant/1111111111",
        quantity: 2,
        appliedDiscount: {        // 👈 sconto solo su questo prodotto
          title: "Promo -10%",
          value: 10,
          valueType: "PERCENTAGE"
        }
      },
      {
        variantId: "gid://shopify/ProductVariant/2222222222",
        quantity: 1,
        appliedDiscount: {        // 👈 sconto fisso su questo prodotto
          title: "Sconto 5€",
          value: 5,
          valueType: "FIXED_AMOUNT"
        }
      }
      {
        title: "Articolo personalizzato",
        quantity: 1,
        originalUnitPrice: 25.0,
      }
    ],
    */
}


module.exports = {create_clients,get_products,get_orders, get_clients, create_order};