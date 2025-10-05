
const get_Cost_per_call = (response) => {
  if (response.extensions && response.extensions.cost) {
    const cost = response.extensions.cost;

    console.log("Actual Query Cost:", cost.actualQueryCost);
    console.log("Throttle Status:", cost.throttleStatus);

  } else {
    console.log("Nessuna informazione sul costo trovata.");
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));



const get_orders = async (client, user) => {
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

  const MAX_RETRIES = 8;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      attempt++;
      const response = await client.request(QUERY, {
        variables: { first: 20 },
      });

      get_Cost_per_call(response);
      return response.data; // ✅ success → esce dal while

    } catch (err) {
      // 🔹 Se è un errore di throttling → aspetta e riprova
      if (err.message.includes("Throttled")) {
        const waitSeconds = 2 * attempt; // aumenta il tempo ad ogni tentativo
        console.warn(`⚠️ Shopify throttled (tentativo ${attempt}/${MAX_RETRIES}) -get_orders. Riprovo tra ${waitSeconds}s...`);
        await sleep(waitSeconds * 1000);
        continue; // riprova il while
      }
      else{
        // 🔹 Altri errori → esci e logga
        console.error("❌ Errore nella chiamata get_orders:", err);
        return { error: "Errore nel prendere i draftOrder. Se persiste contatta l'amministratore" };
      }
    }
  }

  // Se esauriti tutti i tentativi
  console.error("❌ Troppi tentativi falliti -draftOrder get-: rate limit non superabile.");
  return { error: "Errore raccolta bozze di ordine. Aggiorna la pagina fra qualche secondo" };
};



// Create Client
const create_clients = async (client, createClient,user) => {
    if (!user) {
      return { error: "Problema con sessione. Contatta l'amministratore" };
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

    const MUTATION = `
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

    const variables = {
      input: {
        firstName: createClient.name,
        lastName: createClient.surname,
        email: createClient.email,
        phone: createClient.phone,
        tags: ["TEST DEVELOPMENT", user],
        note: `Creato attraverso API dall'utente - ${user}`,
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
            phone: createClient.phone,
          },
        ],
      },
    };

    const MAX_RETRIES = 8;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        attempt++;

        // Controlla se il cliente esiste già
        const check = await client.request(CUSTOMER_SEARCH, {
          variables: { query: `email:${createClient.email}` },
        });

        const existingCustomer = check.data.customers.edges[0]?.node;
        if (existingCustomer) {
          return { error: "Cliente già esistente" };
        }

        return {error:"Blocked"}
        // Se non esiste, crea il cliente
        const response = await client.request(MUTATION, { variables });

        // Gestione errori del mutation
        if (response.data.customerCreate.userErrors.length > 0) {
          console.log("Errori:", response.data.customerCreate.userErrors);
          return {
            error: "Errore compilazione dati. Se persiste contattare amministratore",
          };
        }

        get_Cost_per_call(response);
        return response.data.customerCreate.customer; // ✅ successo

      } catch (err) {
        // 🔹 Shopify GraphQL Throttled → attesa + retry
        if (err.message.includes("Throttled")) {
          const waitSeconds = 2 * attempt; // backoff progressivo
          console.warn(`⚠️ Shopify throttled (tentativo ${attempt}/${MAX_RETRIES}) - create_clients. Riprovo tra ${waitSeconds}s...`);
          await sleep(waitSeconds * 1000);
          continue; // riprova il ciclo while
        }else{
          // 🔹 Altri errori → esci subito
          console.error("❌ Errore creazione cliente:", err);
          return { error: "Errore nel creare il cliente. Se persiste contatta l'amministratore" };
        }
      }
    }

    // Se esauriti tutti i tentativi
    console.error("❌ Troppi tentativi -client post-: limite Shopify non superabile.");
    return { error: "Errore crezione cliente. Riprova fra qualche secondo" };
};


// Get all clients
const get_clients = async (client) => {
  const QUERY = `
    query CustomerList($first: Int!, $after: String) {
      customers(first: $first, after: $after, reverse: true) {
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
    }
  `;

  let hasNextPage = true;
  let after = undefined;
  let allCustomers = [];

  const MAX_RETRIES = 8;

  while (hasNextPage) {
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        attempt++;

        const response = await client.request(QUERY, {
          variables: { first: 250, after },
        });

        get_Cost_per_call(response);

        const { edges, pageInfo } = response.data.customers;
        if (!edges || edges.length === 0) break;

        allCustomers.push(...edges.map((edge) => edge.node));

        hasNextPage = pageInfo.hasNextPage;
        after = pageInfo.endCursor;

        // Se la pagina è andata bene esce dal retry loop
        break;

      } catch (err) {

        if (err.message.includes("Throttled")) {
          let waitSeconds = 2 * attempt;

          console.warn(`⚠️ Shopify throttled (tentativo ${attempt}/${MAX_RETRIES}) - get_clients. Riprovo tra ${waitSeconds}s...`);
          await sleep(waitSeconds * 1000);
          continue; // riprova il ciclo while interno
        }else{
          // Altri errori e esci e logga
          console.error("❌ Errore in get_clients:", err);
          return { error: "Cannot get clients" };
        }
      }
    }

    if (attempt >= MAX_RETRIES) {
      console.error("❌ Troppi tentativi -client get-: limite Shopify non superabile.");
      return { error: "Errore raccolta clienti. Aggiorna la pagina fra qualche secondo" };
    }
  }

  return allCustomers;
};



// --------------------------------------------------------------------------------------------------------------------
// Consideriamo solo una viriante per prodotto, non multipli a prodotto
// --------------------------------------------------------------------------------------------------------------------
const get_products = async (client) => {
  const QUERY = `
    query products($first: Int!, $after: String) {
      products(first: $first, after: $after, reverse: true) {
        edges {
          cursor
          node {
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
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  let hasNextPage = true;
  let after = undefined;
  let allProducts = [];

  const MAX_RETRIES = 5;

  while (hasNextPage) {
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        attempt++;

        const response = await client.request(QUERY, {
          variables: { first: 250, after },
        });

        get_Cost_per_call(response);

        const { edges, pageInfo } = response.data.products;
        if (!edges || edges.length === 0) break;

        allProducts.push(...edges.map((edge) => edge.node));

        hasNextPage = pageInfo.hasNextPage;
        after = pageInfo.endCursor;

        // ✅ Pagina completata correttamente → esci dal retry loop
        break;

      } catch (err) {
        // Se Shopify ci blocca (rate limit)
        if (err.message.includes("Throttled")) {
          let waitSeconds = 2 * attempt; // fallback di base

          console.warn(`⚠️ Shopify throttled (tentativo ${attempt}/${MAX_RETRIES}) - get_products. Riprovo tra ${waitSeconds}s...`);
          await sleep(waitSeconds * 1000);
          continue; // riprova il ciclo interno
        }else{
          // 🔹 Altri errori → log e uscita
          console.error("❌ Errore in get_products:", err);
          return { error: "Cannot retrieve products" };
        }
      }
    }

    if (attempt >= MAX_RETRIES) {
      console.error("❌ Troppi tentativi -products get-: limite Shopify non superabile.");
      return { error: "Errore raccolta prodotti. Aggiorna la pagina fra qualche secondo" };
    }
  }

  return allProducts;
};



// Create draftOrder
const create_order = async (client, draftOrder, user) => {
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

  // Costruzione variabili ordine
  const variables = {
    input: {
      customerId: draftOrder.customer.customerId, // ID cliente Shopify
      note: `Creato attraverso API dall'utente - ${user}`,
      tags: ["TEST-DEVELOPMENT", user],

      // 🔹 Prodotti
      lineItems: draftOrder.products,

      // 🔹 Indirizzo di spedizione
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
        phone: draftOrder.customer.phone,
      },

      // 🔹 Sconto globale
      appliedDiscount: {
        title: draftOrder.globalDiscount.title,
        value: draftOrder.globalDiscount.value,
        valueType: draftOrder.globalDiscount.valueType,
      },

      presentmentCurrencyCode: "EUR",
    },
  };

  const MAX_RETRIES = 8;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      attempt++;
      console.log(variables)
      return {error:"Blocked"}

      const response = await client.request(MUTATION, { variables });

      // Controllo errori logici nella mutation
      if (response.data.draftOrderCreate.userErrors.length > 0) {
        console.log("Errori:", response.data.draftOrderCreate.userErrors);
        return { error: "Errore nella creazione dell'ordine. Se persiste contatta l'amministratore" };
      }

      // Log del costo per chiamata
      get_Cost_per_call(response);

      // Tutto ok → ritorna l’ordine creato
      return response.data.draftOrderCreate.draftOrder;

    } catch (err) {
      // 🔹 Se Shopify ha limitato la chiamata
      if (err.message.includes("Throttled")) {
        let waitSeconds = 2 * attempt; // fallback

        console.warn(`⚠️ Shopify throttled (tentativo ${attempt}/${MAX_RETRIES})- create_order. Riprovo tra ${waitSeconds}s...`);
        await sleep(waitSeconds * 1000);
        continue; // riprova il ciclo while
      }

      // 🔹 Altri errori → log e ritorna
      console.error("❌ Errore nella creazione ordine:", err);
      return { error: "Cannot create draftOrder" };
    }
  }

  console.error("❌ Troppi tentativi -draftOrder post-: limite Shopify non superabile.");
  return { error: "Errore creazione bozza ordine. Riprova fra qualche secondo" };

};
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


module.exports = {create_clients,get_products,get_orders, get_clients, create_order};