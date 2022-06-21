const express = require("express");
const ejs = require("ejs");
const fetch = require("node-fetch");
const fs = require("fs");
var path = require("path");
const { json } = require("express/lib/response");
const app = express();
const mongoose = require("mongoose");
const accT = require("./important_data/access_token.json");
mongoose.pluralize(null);

const Schema = mongoose.Schema;
mongoose.connect("mongodb://localhost:27017/etsy_shops");

const ReviewSchema = new Schema({
  shop_id: {
    type: "Number",
  },
  listing_id: {
    type: "Number",
  },
  transaction_id: {
    type: "Number",
  },
  buyer_user_id: {
    type: "Number",
  },
  rating: {
    type: "Number",
  },
  review: {
    type: "String",
  },
  language: {
    type: "String",
  },
  image_url_fullxfull: {
    type: "Mixed",
  },
  create_timestamp: {
    type: "Number",
  },
  created_timestamp: {
    type: "Number",
  },
  update_timestamp: {
    type: "Number",
  },
  updated_timestamp: {
    type: "Number",
  },
});

app.use(express.static("views"));
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// This renders our `index.hbs` file.
app.get("/", async (req, res) => {
  res.render("index");
});

/**
These variables contain your API Key, the state sent
in the initial authorization request, and the client verifier compliment
to the code_challenge sent with the initial authorization request
*/
const clientID = "6xhwtnjudbrqsjpocccu6dvx";
const clientVerifier = "nwDOgS_psLanxbB2RUY_N9gDllenV4nB82rSWDtfklY";
const redirectUri = "http://localhost:3004/oauth/redirect";

app.get("/oauth/redirect", async (req, res) => {
  // The req.query object has the query params that Etsy authentication sends
  // to this route. The authorization code is in the `code` param
  const authCode = req.query.code;
  const tokenUrl = "https://api.etsy.com/v3/public/oauth/token";
  const requestOptions = {
    method: "POST",
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientID,
      redirect_uri: redirectUri,
      code: authCode,
      code_verifier: clientVerifier,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  };

  const response = await fetch(tokenUrl, requestOptions);
  console.log(response);
  // Extract the access token from the response access_token data field
  if (response.ok) {
    const tokenData = await response.json();
    res.redirect(`/dataview?access_token=${tokenData.access_token}`);
    await fs.writeFileSync(
      "important_data/access_token.json",
      JSON.stringify(tokenData.access_token)
    );
  } else {
    res.send("oops 1");
  }
});
app.get("/dataview", async (req, res) => {
  const { access_token } = req.query;
  const user_id = access_token.split(".")[0];
  const requestOptions = {
    headers: {
      "x-api-key": clientID,
      // Scoped endpoints require a bearer token
      Authorization: `Bearer ${access_token}`,
    },
  };
  // Kullanıcının user id'si ile mağaza ismini alıyoruz
  const shop_by_user_id = await fetch(
    `https://openapi.etsy.com/v3/application/users/${user_id}/shops`,
    requestOptions
  );
  const shop_by_user_id1 = await shop_by_user_id.json();
  console.log(shop_by_user_id1.shop_name);

  // User ID 'yi isim'e çeviriyoruz. Böylece yorumu yapan kişinin id'si değil adı görünecek
  const id_to_name = await fetch(
    `https://openapi.etsy.com/v3/application/users/${user_id}`,
    requestOptions
  );
  const id_to_name1 = await id_to_name.json();
  console.log(id_to_name1.first_name + " " + id_to_name1.last_name);

  // Shop id 'ye göre reviewleri fetch ediyoruz
  const response_review = await fetch(
    //`https://api.etsy.com/v3/application/users/${user_id}/reviews`,
    `https://openapi.etsy.com/v3/application/shops/${shop_by_user_id1.shop_id}/reviews?limit=100`,
    {
      headers: {
        "x-api-key": clientID,
        // Scoped endpoints require a bearer token
        Authorization: `Bearer ${access_token}`,
      },
    }
  );
  // Mağaza Adı ve Standart userData ile review fetching
  async function createFolderWrite(shop_name, userData) {
    try {
      // Mağaza Adına bir klasör varsa direkt json dosyasını içine yazıyor/güncelliyor
      let path_shop = `shops/${shop_name}/`;
      if (fs.existsSync(path_shop)) {
        console.log(`${shop_name} folder already EXISTS!`);
        console.log(`JSON file writing...`);
        fs.writeFileSync(
          `shops/${shop_name}/review.json`,
          JSON.stringify(userData)
        );
        // Mağaza adına bir klasör yoksa önce klasör oluşturuyor, ardından json dosyasını içine yazıyor
      } else {
        console.log(`${shop_name} folder CREATING!`);
        console.log(`JSON file writing...`);
        fs.mkdirSync(`shops/${shop_name}/`);
        fs.writeFileSync(
          `shops/${shop_name}/review.json`,
          JSON.stringify(userData)
        );
      }
    } catch (err) {
      console.log(err);
    }
  }

  // Json Dosyasındaki her yorum için user_id çekilip yorumun elementlerine
  // first_name - last_name eklenecek
  // SORUN === JSON DOSYASI KARMAŞIK GELDİĞİ İÇİN EDİTLEYEMİYORUZ. ÇÖZÜM BUL
  // ÇÖZÜLDÜ !

  if (response_review.ok) {
    const userData = await response_review.json();
    const Review = mongoose.model(
      `${shop_by_user_id1.shop_name}`,
      ReviewSchema
    );

    if (Review) {
      console.log("DB is already created. New data pushing..");
      mongoose.connection.db.dropCollection(
        `${shop_by_user_id1.shop_name}`,
        (err, data) => {
          if (err) {
            console.log(err);
          }
        }
      );
      await Review.create(userData["results"]);
    } else {
      await Review.create(userData["results"]);
      console.log("Shop DB Created");
    }
    //Review.create(userData["results"][1]);

    //console.log(userData["results"]);
    createFolderWrite(shop_by_user_id1.shop_name, userData);
    //console.log(startNumber);
    res.render("dataview");
  } else {
    res.send("oops 2");
  }
});

app.get("/lookup_shop", (req, res) => {
  res.render("lookup_shop");
});
app.post("/lookup_shop1", async (req, res) => {
  const shopname = await fetch(
    `https://openapi.etsy.com/v3/application/shops?shop_name=${req.body.title}`,
    {
      headers: {
        "x-api-key": "6xhwtnjudbrqsjpocccu6dvx",
        // Bearer and ACCESS TOKEN
        Authorization: `Bearer ${accT}`,
      },
    }
  );
  const test = await shopname.json();
  const shop_id001 = test.results[0]["shop_id"];
  console.log(shop_id001);
  const listin = await fetch(
    `https://openapi.etsy.com/v3/application/shops/${shop_id001}/listings`,
    {
      headers: {
        "x-api-key": "6xhwtnjudbrqsjpocccu6dvx",
        Authorization: `Bearer ${accT}`,
      },
    }
  );
  const listing = await listin.json();
  console.log(listing);
  //console.log(test.results[0]["sale_message"]);
  //console.log(test.results[0]["listing_active_count"]);

  console.log(req.body.title);
  res.render("shop_details", { test: test });
});

app.get("/shop_details", async (req, res) => {
  res.render("shop_details");
});

const port = 3004;
app.listen(port, () => console.log(`http://localhost:${port}`));
