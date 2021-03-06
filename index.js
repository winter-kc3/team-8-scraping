const puppeteer = require('puppeteer');
const admin = require('firebase-admin');
const env = require("./serviceAccountKey.json");
const urls = require("./urls.json");

admin.initializeApp({
    credential: admin.credential.cert({
        type: env.type,
        project_id: env.project_id,
        project_key_id: env.project_key_id,
        private_key: env.private_key.replace(/\\n/g, '\n'),
        client_email: env.client_email,
        client_id: env.client_id,
        auth_url: env.auth_url,
        token_url: env.token_url,
        auth_provider_x509_cert_url: env.auth_provider_x509_cert_url,
        client_x509_cert_url: env.client_x509_cert_url
    })
});

const db = admin.firestore();

// firestoreに書き込むコレクションを指定
const writeCollection = { pages: "samplePages", paths: "samplePaths" }

// じゃらんのカテゴリーページから要素を取得
async function jaranCategory(url_path) {
    const brower = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'], slowMo: 1000
    })
    const page = await brower.newPage()
    await page.goto(url_path)

    const scrapingData = await page.evaluate(() => {
        const dataList = [];
        const titleList = document.querySelectorAll("p.item-name a");
        const imgList = document.querySelectorAll(".item-mainImg img");
        for (let i = 0, l = titleList.length; i < l; i++) {
            placeCard = {
                title: titleList[i].innerText,
                url: "https:" + titleList[i].getAttribute("href")
            }
            
            let img_path = imgList[i].getAttribute("src")
            // LINE Message API は png, jpg の画像にしか対応していないのでそれ以外を弾く
            if (~img_path.indexOf("png") || ~img_path.indexOf("PNG") ||
                ~img_path.indexOf("jpg") || ~img_path.indexOf("jpeg") || ~img_path.indexOf("JPG")) {
                placeCard["img"] = "https:" + img_path
            }
            dataList.push(placeCard)
        }
        // [{title: ◯◯, url: ◯◯, img: ◯◯}, ...]
        return dataList;
    });

    await brower.close()
    return scrapingData
};


(async () => {
    for (key in urls) {
        let categoryData = await jaranCategory(urls[key]);
        let docList = []
        for (data of categoryData) {
            docList.push(await db.collection(writeCollection["pages"]).add(data).then(ref => {
                return db.collection(writeCollection["pages"]).doc(ref.id);
            }))
        }
        db.collection(writeCollection["paths"]).add({ path: key, hits: docList })
        console.log(key + "  done!")
    }
})();

