const express = require("express");
const ejs = require("ejs");
const fetch = require("node-fetch");
const fs = require("fs");
var path = require("path");
const { json } = require("express/lib/response");
const app = express();

app.use(express.static("views"));
app.set("view engine", "ejs");

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
    `https://openapi.etsy.com/v3/application/shops/${shop_by_user_id1.shop_id}/reviews`,
    requestOptions
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
  async function addFLname() {
    const json_read = JSON.stringify(
      fs.readFileSync("shops/VintagePillowRug/review.json")
    );
    console.log(json_read);
  }
  addFLname();

  if (response_review.ok) {
    const userData = await response_review.json();
    createFolderWrite(shop_by_user_id1.shop_name, userData);
    res.render("dataview");
  } else {
    res.send("oops 2");
  }
});

const port = 3004;
app.listen(port, () => console.log(`http://localhost:${port}`));
