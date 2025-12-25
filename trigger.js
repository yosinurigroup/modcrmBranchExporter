// trigger.js
require('dotenv').config();
const { processBranch } = require('./index');

// Dummy payload matching your Apps Script structure
const payload = {
    "projectsData": [
        {
            "projects": "C33768BA",
            "customerId": "CID 09A619F0",
            "projectFolders": "https://drive.google.com/drive/folders/1hpjhc7rCNGf0N4t3Krvx2sUZOYderKNr"
        },
        {
            "projects": "1B970B80",
            "customerId": "CID CD9893EC",
            "projectFolders": "https://drive.google.com/drive/folders/19xROa1d04uBh610cIN0zXtpKO4ERK9SW"
        },
        {
            "projects": "90EA43B3",
            "customerId": "CID 97A0CB04",
            "projectFolders": "https://drive.google.com/drive/folders/1G3wHYnre4Eat2nA_TNW6C4bEO7Z-c5Wm"
        },
        {
            "projects": "71D3B3C8",
            "customerId": "CID BB12FB7E",
            "projectFolders": "https://drive.google.com/drive/folders/1tPF9Q03TkqyezoRLzmIaTOozHMIcDLPp"
        },
        {
            "projects": "F00DFF51",
            "customerId": "CID 0F86531E",
            "projectFolders": "https://drive.google.com/drive/folders/1CAXcEL_9Wn8wvBNBoiBT5uA1VSlm9pXA"
        },
        {
            "projects": "C5533B05",
            "customerId": "CID AC3C2D0C",
            "projectFolders": "https://drive.google.com/drive/folders/1_-M3rJrQvo1pr1BKdoQ6B38-PaVz6Eha"
        },
        {
            "projects": "E3697DFA",
            "customerId": "CID 2161BAE5",
            "projectFolders": "https://drive.google.com/drive/folders/1RbUqc-cQbiR97LZAlOUcpl4ayTjb1sXO"
        },
        {
            "projects": "9BACC3E0",
            "customerId": "CID ACFA7D04",
            "projectFolders": "https://drive.google.com/drive/folders/13OFYOZQ6FUsqLqq4T9HdI1WggvHutJqS"
        },
        {
            "projects": "5EBF891B",
            "customerId": "CID 87FFD0AC",
            "projectFolders": "https://drive.google.com/drive/folders/1yRKPIxqOZkUXMvJg942_hHSRx_Lf6lJQ"
        },
        {
            "projects": "9A469F36",
            "customerId": "CID 3AFA3AC3",
            "projectFolders": "https://drive.google.com/drive/folders/1QxWjhT9Ce3PGlea2XMziVg3xlfzBgQc-"
        },
        {
            "projects": "2911BB3F",
            "customerId": "CID C36AF5F9",
            "projectFolders": "https://drive.google.com/drive/folders/1ao9lv598ThmtnlroKZA3Fn36MkJCxKFR"
        },
        {
            "projects": "C1E82EA2",
            "customerId": "CID 18963DE5",
            "projectFolders": "https://drive.google.com/drive/folders/1vfGrbXsmTVOjII2JS6adNENjRf8DPrBI"
        },
        {
            "projects": "0C4A1F27",
            "customerId": "CID 6BC954CE",
            "projectFolders": "https://drive.google.com/drive/folders/1WzuqHjn2ShFccq2iM8-e_nafdiThuUrj"
        },
        {
            "projects": "9BE819F5",
            "customerId": "CID DABD1684",
            "projectFolders": "https://drive.google.com/drive/folders/1E15Z1CdbvLoj7XWnlDPnLvNLjK8AHIXb"
        },
        {
            "projects": "6E781ABD",
            "customerId": "CID CFB24DD9",
            "projectFolders": "https://drive.google.com/drive/folders/1-L4CSImcIbaYIICHE5PQxx9ug4cer4KT"
        },
        {
            "projects": "732DD2CC",
            "customerId": "CID 9973C664",
            "projectFolders": "https://drive.google.com/drive/folders/1OGRXQ53Z0LEprFVx6FbhUkXc1DAAl5hZ"
        },
        {
            "projects": "9C757C59",
            "customerId": "CID 489B9ADA",
            "projectFolders": "https://drive.google.com/drive/folders/1aHh5Sf6y1FwZ0iPF4Ydqs9MGlWBMKJMu"
        },
        {
            "projects": "EE0EF473",
            "customerId": "CID 674F0661",
            "projectFolders": "https://drive.google.com/drive/folders/1xzDPTQZBF40ot0w9Ya16HhwI4CKjaGS2"
        },
        {
            "projects": "9F1FD7DD",
            "customerId": "CID B8D8DC06",
            "projectFolders": "https://drive.google.com/drive/folders/1IfsGlrJKns3qkKnHhFV9NbXHNTsqRlN1"
        },
        {
            "projects": "24F4FF5B",
            "customerId": "CID 7B9EE8D4",
            "projectFolders": "https://drive.google.com/drive/folders/1cEbmvMcllrRfEMrrSqUnmRafuhJ2p7OK"
        },
        {
            "projects": "A4353432",
            "customerId": "CID ED165F06",
            "projectFolders": "https://drive.google.com/drive/folders/1g5Bn-rpfeRGcNAIxI8xzoEXKKCfPP2Cy"
        },
        {
            "projects": "C05A13FB",
            "customerId": "CID 5EE816AB",
            "projectFolders": "https://drive.google.com/drive/folders/17MFkQQLHnA4FeBh9y2Qi5EqhCTpFUZmt"
        },
        {
            "projects": "B20606AB",
            "customerId": "CID CB6DC0C0",
            "projectFolders": "https://drive.google.com/drive/folders/1phHxnhIMuEujx8epcvptUtaANiK7dza9"
        },
        {
            "projects": "A707E705",
            "customerId": "CID 82019AA9",
            "projectFolders": "https://drive.google.com/drive/folders/1Zokgc_FiXS9-Zo13IirAOZRFZvt7v4hM"
        },
        {
            "projects": "8C5AFE24",
            "customerId": "CID DC3D45F8",
            "projectFolders": "https://drive.google.com/drive/folders/1x-cbYD8LxJot3J0J311RAmpbgqA6lxYf"
        },
        {
            "projects": "47615016",
            "customerId": "CID F92A1AE3",
            "projectFolders": "https://drive.google.com/drive/folders/1fCrVh9I1mXhRN-RiNylRXkQJLTH7Cnjm"
        },
        {
            "projects": "148F9399",
            "customerId": "CID 2161BAE5",
            "projectFolders": "https://drive.google.com/drive/folders/18Rzkl25iSuv3UZu_atiGaqwhCL7g61o4"
        },
        {
            "projects": "351E4DC7",
            "customerId": "CID EF4B7883",
            "projectFolders": "https://drive.google.com/drive/folders/1Mx6OzNzFyrmUouylTUDFz2BziY0Mixsx"
        },
        {
            "projects": "96497168",
            "customerId": "CID 0BAF9A8A",
            "projectFolders": "https://drive.google.com/drive/folders/1fvEbU9iJqxTkzHYE7FLmLsV4oS_OJnnS"
        },
        {
            "projects": "98859CBA",
            "customerId": "CID 6BC954CE",
            "projectFolders": "https://drive.google.com/drive/folders/14ptxLQsRmCQ74r2OjWhuFVsyGT88qdXJ"
        },
        {
            "projects": "91CCEB31",
            "customerId": "CID CC1AC4B6",
            "projectFolders": "https://drive.google.com/drive/folders/1zuYxiuLpT-jK15-zwAhdju1OLQWfZ5NG"
        },
        {
            "projects": "7DD52E2B",
            "customerId": "CID F92A1AE3",
            "projectFolders": "https://drive.google.com/drive/folders/1G_ZeZDIPKrvylOnwELnwudzsAWVSMbNx"
        },
        {
            "projects": "6711A4A2",
            "customerId": "CID 783F7CCF",
            "projectFolders": "https://drive.google.com/drive/folders/1ouIb30UWQKuFl3sW0T6NMNvGLv7IXX70"
        },
        {
            "projects": "352B99B5",
            "customerId": "CID 783F7CCF",
            "projectFolders": "https://drive.google.com/drive/folders/1WhvHaD6iqMoNf1ih5itiv42IDy82lZUj"
        },
        {
            "projects": "1722CD2C",
            "customerId": "CID E3C3B6BD",
            "projectFolders": "https://drive.google.com/drive/folders/1DNzLcNjM1sIQd83tTxD5j-Z4eUFZ-MMo"
        },
        {
            "projects": "B2BBDE9C",
            "customerId": "CID 4687DD9D",
            "projectFolders": "https://drive.google.com/drive/folders/13c41z4j8fXZfggB4f1JpcGSy4WfUVEYP"
        },
        {
            "projects": "B15DA9AD",
            "customerId": "CID E0CDF521",
            "projectFolders": "https://drive.google.com/drive/folders/1weyeDbqe5Hh1Na4N8wnF5_S6wTb1SK7r"
        },
        {
            "projects": "4283987F",
            "customerId": "CID 1A1AAA31",
            "projectFolders": "https://drive.google.com/drive/folders/1SdjeLLSADerMKKS-77fGWXvDPCRS1al5"
        },
        {
            "projects": "BA92DF99",
            "customerId": "CID 674F0661",
            "projectFolders": "https://drive.google.com/drive/folders/1o9KZzl3d3rJOYMzrLh5q8soWWeW5XOSx"
        },
        {
            "projects": "70DBAEE4",
            "customerId": "CID B7ED9DA9",
            "projectFolders": "https://drive.google.com/drive/folders/1opXLsHhG7AhgsS86T3Sh76UenP0PNMCH"
        },
        {
            "projects": "8BFABD17",
            "customerId": "CID 93C8A34D",
            "projectFolders": "https://drive.google.com/drive/folders/1ysfq2-KOAliyy0bLhBngt3Mb-v5CGo5w"
        },
        {
            "projects": "0060EF27",
            "customerId": "CID B567F7DE",
            "projectFolders": "https://drive.google.com/drive/folders/1rmmBFDt6TfJAb4jXHiW7gB7DjnkmB-aC"
        },
        {
            "projects": "2D1301AC",
            "customerId": "CID B567F7DE",
            "projectFolders": "https://drive.google.com/drive/folders/1eNdVaRs3yAOliJWRrRLLOgMl3uevo48z"
        },
        {
            "projects": "3871BA18",
            "customerId": "CID D8E485BC",
            "projectFolders": "https://drive.google.com/drive/folders/1Hui2g3RLmAC2xoWvUNhrcv7bVdNUJPH7"
        },
        {
            "projects": "222628FC",
            "customerId": "CID B567F7DE",
            "projectFolders": "https://drive.google.com/drive/folders/1IYipegUsP9kXUh4KxvbqW_DzwcSbVALs"
        },
        {
            "projects": "5D570990",
            "customerId": "CID AE75B914",
            "projectFolders": "https://drive.google.com/drive/folders/1-e2Ijp5AOqZz7E2YS3S5VRySfkfGtwt5"
        },
        {
            "projects": "C941A6A8",
            "customerId": "CID A75A2D8D",
            "projectFolders": "https://drive.google.com/drive/folders/1qxlexqZPs36cccLKAC4Kk4a3WrR8YAho"
        },
        {
            "projects": "7BEC3080",
            "customerId": "CID 5B7A2BC2",
            "projectFolders": "https://drive.google.com/drive/folders/1Z3_95ayqDdnkEbR_Vs8Xc3JnC5HyjeEM"
        },
        {
            "projects": "54E9A20E",
            "customerId": "CID 63C0416A",
            "projectFolders": "https://drive.google.com/drive/folders/1xJg1KRcgzBX_1WvtfFt0tGehHhW_FN_G"
        },
        {
            "projects": "41E40FAE",
            "customerId": "CID 65BE178D",
            "projectFolders": "https://drive.google.com/drive/folders/1mihgsDVHU5UZyoTiL5dNZHh4AugfUYv1"
        },
        {
            "projects": "EDCBC711",
            "customerId": "CID 87345188",
            "projectFolders": "https://drive.google.com/drive/folders/1Ra7GWtsFrpcQY418z0BZPF9O97unBoqW"
        },
        {
            "projects": "7F6D60AC",
            "customerId": "CID DAFA7444",
            "projectFolders": "https://drive.google.com/drive/folders/1XudgRNXJRdF3dOuaUsZLLgYYWdWAuNWU"
        },
        {
            "projects": "EA4DBBDB",
            "customerId": "CID AA5FE018",
            "projectFolders": "https://drive.google.com/drive/folders/1BHtNis8y189bZnWEvBCMI_gT6-Djt6RG"
        },
        {
            "projects": "A66DA365",
            "customerId": "CID 73DABB8A",
            "projectFolders": "https://drive.google.com/drive/folders/1_A6_IFgaiAlpNTmep7y1ZZlT3JOFeDPA"
        },
        {
            "projects": "84B4736D",
            "customerId": "CID CB6DC0C0",
            "projectFolders": "https://drive.google.com/drive/folders/1XTZKSAI-NZBx2CNot2uttx4hzkTNbE_k"
        },
        {
            "projects": "0FF916E0",
            "customerId": "CID 1560C2B7",
            "projectFolders": "https://drive.google.com/drive/folders/1L1T-dK3KVQdsjsbL436-hn8_j7ztSbsB"
        },
        {
            "projects": "517CE5C3",
            "customerId": "CID A186331B",
            "projectFolders": "https://drive.google.com/drive/folders/1MYIlUzmqIcJW_R2URGBgmtcYeg1lfk96"
        },
        {
            "projects": "E80F0902",
            "customerId": "CID B541B449",
            "projectFolders": "https://drive.google.com/drive/folders/19Q7xcKm8H94EdfmAKvJScH3h-IAQKLgn"
        },
        {
            "projects": "5B2A6FBF",
            "customerId": "CID 94EBC589",
            "projectFolders": "https://drive.google.com/drive/folders/1agAQR4TtnFBAev1CqmSeoNjuNVsakOB_"
        },
        {
            "projects": "C9C50A3C",
            "customerId": "CID 94EBC589",
            "projectFolders": "https://drive.google.com/drive/folders/1fKnVwO4Hsk9SzKS8jMzOpinPpNMAauYF"
        },
        {
            "projects": "A01D4BBB",
            "customerId": "CID 4060F4FC",
            "projectFolders": "https://drive.google.com/drive/folders/1TlxWVrxHsin9JEve8lgU46LbykcZA6Rx"
        },
        {
            "projects": "9358D29D",
            "customerId": "CID B567F7DE",
            "projectFolders": "https://drive.google.com/drive/folders/1tmvHFIDPZjk8XtY7RSs52pBwl9Dk5M4k"
        },
        {
            "projects": "F480787E",
            "customerId": "CID C6211739",
            "projectFolders": "https://drive.google.com/drive/folders/1VkG80Auz_5hnS8VgAC8E4vNadEfbk4AG"
        },
        {
            "projects": "5FB53CC6",
            "customerId": "CID A75A2D8D",
            "projectFolders": "https://drive.google.com/drive/folders/15W0Gnzlg9Z1pIWxfsn8PQFSxl7GVViRy"
        },
        {
            "projects": "B84FFFDE",
            "customerId": "CID A75A2D8D",
            "projectFolders": "https://drive.google.com/drive/folders/10SFmvRtVr9Zf3V9F-Zgr8uckU7aQvMYI"
        },
        {
            "projects": "96597AD5",
            "customerId": "CID A75A2D8D",
            "projectFolders": "https://drive.google.com/drive/folders/1hfuRCaYfZiFOAZE18gDLcT6cKlYuAvzT"
        },
        {
            "projects": "DAFBD608",
            "customerId": "CID A75A2D8D",
            "projectFolders": "https://drive.google.com/drive/folders/1MMKeuza7I2iKWEX6L_DwgjQrJpdSbMHU"
        },
        {
            "projects": "7F39011E",
            "customerId": "CID A75A2D8D",
            "projectFolders": "https://drive.google.com/drive/folders/1iPqvA9AwQqkUuQurFkdmjnnfWUl_80-c"
        },
        {
            "projects": "3E4CFDF1",
            "customerId": "CID 56BE5FAD",
            "projectFolders": "https://drive.google.com/drive/folders/1MSWV1QCqBRV4X8865O8duhds77G78Aop"
        },
        {
            "projects": "4C5AE4A4",
            "customerId": "CID B567F7DE",
            "projectFolders": "https://drive.google.com/drive/folders/18LE0axPMO8xO14BptXIpUQKSlLK9LsJh"
        },
        {
            "projects": "C770CA7D",
            "customerId": "CID 87CEA26B",
            "projectFolders": "https://drive.google.com/drive/folders/1XBLl3_-2RSqqSJBEMfAx4ia1nPUHswbi"
        },
        {
            "projects": "D7631F28",
            "customerId": "CID ED2952D3",
            "projectFolders": "https://drive.google.com/drive/folders/1DQ_-2eihXNFsblLxT8ojE0-Dcm7-_VGU"
        },
        {
            "projects": "02AFB54E",
            "customerId": "CID 6C629A96",
            "projectFolders": "https://drive.google.com/drive/folders/1AOIMKs2D7N31id2ZgkkLb5I7A78C9zLt"
        },
        {
            "projects": "F3CD4DD9",
            "customerId": "CID 6C629A96",
            "projectFolders": "https://drive.google.com/drive/folders/1TVlpCaclKyd26uB1Sb_2xnltAFsbpVw4"
        },
        {
            "projects": "315C2B5C",
            "customerId": "CID 7B9EE8D4",
            "projectFolders": "https://drive.google.com/drive/folders/1Yv-jVPqZVvZg9VtyNw0itzIU9VZtA1xX"
        },
        {
            "projects": "16DCCEDF",
            "customerId": "CID 7D5906D5",
            "projectFolders": "https://drive.google.com/drive/folders/1EqoH9iM8lNM2Pt-5DPZ5DioMKDtKqVRb"
        },
        {
            "projects": "5CC28D13",
            "customerId": "CID ACA48C16",
            "projectFolders": "https://drive.google.com/drive/folders/1UHnKpmZph0qPEc31ZT9yTJH5tgSxDQ8m"
        },
        {
            "projects": "E64CB964",
            "customerId": "CID CED558C8",
            "projectFolders": "https://drive.google.com/drive/folders/1SKLvVP_aIuGl6pgPHa95Pk7jjGMwHTRl"
        },
        {
            "projects": "5EBDB937",
            "customerId": "CID 1560C2B7",
            "projectFolders": "https://drive.google.com/drive/folders/1nlFzth1ATSLtFRjnGYjr4LxtZW8b6X1n"
        },
        {
            "projects": "E6DEF6E8",
            "customerId": "CID 96AE05C8",
            "projectFolders": "https://drive.google.com/drive/folders/1GMimn6-a4nSZ0qwszkVke0F5oS670bhZ"
        },
        {
            "projects": "CEC7CABC",
            "customerId": "CID 5B9D6B57",
            "projectFolders": "https://drive.google.com/drive/folders/1n_lR56jGvTI23NBCzixt9EI9a0a7hOI_"
        },
        {
            "projects": "D0065D45",
            "customerId": "CID 68A86BFA",
            "projectFolders": "https://drive.google.com/drive/folders/1BgRwqQtN5cGLsAtaKIwJdgdUfUDSUvM_"
        },
        {
            "projects": "5D4780AF",
            "customerId": "CID AE75B914",
            "projectFolders": "https://drive.google.com/drive/folders/1Yzvhom0FSNpa6sk7PYZow_aBpUDJYO7E"
        },
        {
            "projects": "B04E76C5",
            "customerId": "CID 71B29A30",
            "projectFolders": "https://drive.google.com/drive/folders/1OhPZm1wqHdrjLfIxvqMMtWXyRNQEMg_e"
        },
        {
            "projects": "4F2A8122",
            "customerId": "CID A186331B",
            "projectFolders": "https://drive.google.com/drive/folders/1gZSsCyWQMhmEPKiQKuyA3ufvY-D0KrU7"
        },
        {
            "projects": "DC61841C",
            "customerId": "CID 2ACDF560",
            "projectFolders": "https://drive.google.com/drive/folders/1kAFq3821oOQdPyewvtIaY9BowWWLsD9m"
        },
        {
            "projects": "89A15982",
            "customerId": "CID 93C8A34D",
            "projectFolders": "https://drive.google.com/drive/folders/19NFgxJXepm6OFFMA9IW87XYcKRgPjoz4"
        },
        {
            "projects": "C32DA740",
            "customerId": "CID 5EE816AB",
            "projectFolders": "https://drive.google.com/drive/folders/1OzjRW5sqCuIUXGaTq2Vbpt7xxcr0qjpj"
        },
        {
            "projects": "63B5C2F8",
            "customerId": "CID 4873CE8F",
            "projectFolders": "https://drive.google.com/drive/folders/15OYLjDhhz2UCu0OhgE-rEr_hLB-0MEOf"
        },
        {
            "projects": "08C77764",
            "customerId": "CID FC3638EA",
            "projectFolders": "https://drive.google.com/drive/folders/10jh2onYr8SoEjbZfWsEnQ8RrJRvIDVR2"
        },
        {
            "projects": "CB6181A2",
            "customerId": "CID 0FECC5A1",
            "projectFolders": "https://drive.google.com/drive/folders/1sEZWIVlGAcrq1XzbKrzNbRzqxEyu2Eh0"
        },
        {
            "projects": "5C02A844",
            "customerId": "CID F373329E",
            "projectFolders": "https://drive.google.com/drive/folders/1HgNCou8w7TSTVgqt07jUbQmNIg4OPjrf"
        },
        {
            "projects": "E96893D2",
            "customerId": "CID F8422172",
            "projectFolders": "https://drive.google.com/drive/folders/1EvH-Qs5KSqJe2Y4y-zJv5w_TXcRO5-Ud"
        },
        {
            "projects": "3AF8B737",
            "customerId": "CID 8C8E9624",
            "projectFolders": "https://drive.google.com/drive/folders/1X5Z_RLqlZtf5ADR_DyMJssYCu6V9G0gY"
        },
        {
            "projects": "C5C96910",
            "customerId": "CID B497D323",
            "projectFolders": "https://drive.google.com/drive/folders/1oTuZd2iJhH1tu2Xz0aN8ZeLUt-NfhYKD"
        },
        {
            "projects": "1C13A020",
            "customerId": "CID 50D0ACF0",
            "projectFolders": "https://drive.google.com/drive/folders/1EpvStzQhb9AiKymObXI38B6SWQUXcFsH"
        },
        {
            "projects": "19161207",
            "customerId": "CID 50D0ACF0",
            "projectFolders": "https://drive.google.com/drive/folders/1C5LHGP1PfDSjk0Rsmb4aElzHG1O_K5RL"
        },
        {
            "projects": "90E24F83",
            "customerId": "CID 150729FA",
            "projectFolders": "https://drive.google.com/drive/folders/1ch8LG6s-At3d_wRiODjhNqn3229gT3ZE"
        },
        {
            "projects": "B82E80DE",
            "customerId": "CID 0BAC7B9B",
            "projectFolders": "https://drive.google.com/drive/folders/1BBHEbp8DPotBDA4q1dh38WaKlVDkgjiR"
        },
        {
            "projects": "C72438BF",
            "customerId": "CID 18204ABC",
            "projectFolders": "https://drive.google.com/drive/folders/13d2uDJd1XBJkMcD6B7Il4XJyzENQXboV"
        },
        {
            "projects": "73D147E2",
            "customerId": "CID F2C56AE8",
            "projectFolders": "https://drive.google.com/drive/folders/114nYkMKBluqRujEi4aTtclgBjLQ2KhsE"
        },
        {
            "projects": "1ECE59BB",
            "customerId": "CID 68A86BFA",
            "projectFolders": "https://drive.google.com/drive/folders/1vk5e2RnQVUV0Viwrgc1eHxIN4BWSLQkS"
        },
        {
            "projects": "825AE703",
            "customerId": "CID 9FEB5012",
            "projectFolders": "https://drive.google.com/drive/folders/1q-3SoLgHNBezjhixiY3oMjQvXCa5_Mpp"
        },
        {
            "projects": "FC2E6110",
            "customerId": "CID 4A628B59",
            "projectFolders": "https://drive.google.com/drive/folders/1tH1Oo4sWbDeSPwHQq6dfIysX-K5brjcx"
        },
        {
            "projects": "8831252A",
            "customerId": "CID A0440681",
            "projectFolders": "https://drive.google.com/drive/folders/1S-5coABZsuJk8kFEJk0nqmwRGAKoPimH"
        },
        {
            "projects": "F7D5AD06",
            "customerId": "CID F48E6A8E",
            "projectFolders": "https://drive.google.com/drive/folders/17QygOF9kAij9B_8YdUCIP4ZnYyjSmS0T"
        },
        {
            "projects": "F6141243",
            "customerId": "CID F48E6A8E",
            "projectFolders": "https://drive.google.com/drive/folders/1VURbmNU1SDaJSDGkAVrA78wBl2tRk0VN"
        },
        {
            "projects": "D2DF32A2",
            "customerId": "CID 0BAC7B9B",
            "projectFolders": "https://drive.google.com/drive/folders/1SK6dsfP-gfwXiRliQzTySp9PXTPo4Hw5"
        },
        {
            "projects": "E0740242",
            "customerId": "CID 150729FA",
            "projectFolders": "https://drive.google.com/drive/folders/1GjvaD8ZF06Q_AxZirKQAawAvEHdLSXp4"
        },
        {
            "projects": "0A74159B",
            "customerId": "CID 50D0ACF0",
            "projectFolders": "https://drive.google.com/drive/folders/1GsyDog3XwXmfFtLUMd9I4UbNp_tIh0Rk"
        },
        {
            "projects": "B6E7EA07",
            "customerId": "CID E80DB3CC",
            "projectFolders": "https://drive.google.com/drive/folders/11QQUKqmQQ5dN-stTxYabP4oUMtZZIgHG"
        },
        {
            "projects": "DBF69729",
            "customerId": "CID E80DB3CC",
            "projectFolders": "https://drive.google.com/drive/folders/1sbOmsRuicouQd930AJMvtI7AEcGyTOSD"
        },
        {
            "projects": "B789BE09",
            "customerId": "CID 4CB01869",
            "projectFolders": "https://drive.google.com/drive/folders/12NbvpeLNO4TJB8163-VGML4eIkaXjy_f"
        },
        {
            "projects": "D60AE5D0",
            "customerId": "CID 837F8173",
            "projectFolders": "https://drive.google.com/drive/folders/1HaqhFwMDxH9fknGAA1kx8woLKSLeG27B"
        },
        {
            "projects": "9C63EE99",
            "customerId": "CID 68830092",
            "projectFolders": "https://drive.google.com/drive/folders/1kH2GnBw-GXe43CEF2JhqxKdRdjff9V4t"
        },
        {
            "projects": "56BA57AA",
            "customerId": "CID CB6DC0C0",
            "projectFolders": "https://drive.google.com/drive/folders/1-SaM8BhlmChBojS-u_gowqhtCoKj3cm5"
        },
        {
            "projects": "4E222BC8",
            "customerId": "CID A75A2D8D",
            "projectFolders": "https://drive.google.com/drive/folders/19DyM4tTq9wfhbtozs0IHFItjl5v7_sBH"
        },
        {
            "projects": "79780840",
            "customerId": "CID 8B273DB2",
            "projectFolders": "https://drive.google.com/drive/folders/1fKl_5LIiTss9FsPoy2ScH1zZ8QD-HOWx"
        },
        {
            "projects": "F5332B9F",
            "customerId": "CID FB6F3F88",
            "projectFolders": "https://drive.google.com/drive/folders/1oUle2X_Kf_cYYwhvmKGIoOFGlVuCXxNe"
        },
        {
            "projects": "34F01966",
            "customerId": "CID DBA7040C",
            "projectFolders": "https://drive.google.com/drive/folders/15zCpEW_fFpufA4kT6kZ_uan7x7Rv6gNY"
        },
        {
            "projects": "0D8A7364",
            "customerId": "CID 33CD186D",
            "projectFolders": "https://drive.google.com/drive/folders/1k7w-ulnIkpWxzFlkhCMyHKRvRkWFycUP"
        },
        {
            "projects": "038A01C1",
            "customerId": "CID B7FFB61A",
            "projectFolders": "https://drive.google.com/drive/folders/1SEdtzsZXmKwXFcaKpIY87n3fO1YZjJiP"
        },
        {
            "projects": "7CE8FC45",
            "customerId": "CID BCE66105",
            "projectFolders": "https://drive.google.com/drive/folders/1A3KmkzgbvRZetmwDYKT7I8_tg0b8iW6W"
        },
        {
            "projects": "8CFF89F4",
            "customerId": "CID C7912F0A",
            "projectFolders": "https://drive.google.com/drive/folders/1lOfcsBzkWvUtxXb9K-RjEwkAZrnPFawl"
        },
        {
            "projects": "24922032",
            "customerId": "CID 25D77065",
            "projectFolders": "https://drive.google.com/drive/folders/1DTFT-n3m2hGU58ynZuw026uYEr4iJpe0"
        },
        {
            "projects": "4CA34FD7",
            "customerId": "CID 1BB36AF2",
            "projectFolders": "https://drive.google.com/drive/folders/1_PN0JCeBQiFaO14LQIWxce72mlRJg2k_"
        }
    ],
    "customersData": [
        {
            "fullName": "Reynaldo Layosa",
            "customerId": "CID 09A619F0",
            "folderlinks": "https://drive.google.com/drive/folders/1-oGEBWqkCOzaJWMdPZLOnuttC9TTO2-c"
        },
        {
            "fullName": "Gerald Walker",
            "customerId": "CID CD9893EC",
            "folderlinks": "https://drive.google.com/drive/folders/1rZDcCKsrtiTEKRMeUf0Z_6xgACN3EToT"
        },
        {
            "fullName": "Desiree Von Rettberg",
            "customerId": "CID 97A0CB04",
            "folderlinks": "https://drive.google.com/drive/folders/1VuwU0U8jcsb0AtrOKXrHfM7vyQiCaGd3"
        },
        {
            "fullName": "Bright Sonya",
            "customerId": "CID BB12FB7E",
            "folderlinks": "https://drive.google.com/drive/folders/1WBjRc_yhpY_mIKeHyWY7190XERw4Tx8p"
        },
        {
            "fullName": "Jose Luis & Luz Reyes",
            "customerId": "CID AC3C2D0C",
            "folderlinks": "https://drive.google.com/drive/folders/191WlYbZr0GAjsFG-9kmT91jUNY_QRZSm"
        },
        {
            "fullName": "Consuelo Marroquin",
            "customerId": "CID 87FFD0AC",
            "folderlinks": "https://drive.google.com/drive/folders/1SV8eriJfj0kDQs3H3A4vyM9hyhLkm2Sn"
        },
        {
            "fullName": "LADRENA TODD",
            "customerId": "CID C36AF5F9",
            "folderlinks": "https://drive.google.com/drive/folders/1LGw032Vq7OXzHpbBw7OqVF39T-aPXpCv"
        },
        {
            "fullName": "Jake Darnell Walker",
            "customerId": "CID CFB24DD9",
            "folderlinks": "https://drive.google.com/drive/folders/1UZaUwqhzA0Mgx_CrGh7hW9xp-tYHFcci"
        },
        {
            "fullName": "Grace Wilbur",
            "customerId": "CID 9973C664",
            "folderlinks": "https://drive.google.com/drive/folders/1t5yCbm4G_e37JUGwCm8pbPypq0FZolS2"
        },
        {
            "fullName": "Marsheille Smiley",
            "customerId": "CID 489B9ADA",
            "folderlinks": "https://drive.google.com/drive/folders/1cNQNlU8zJ2eJBKebUd_ElsTGJqTZ-soG"
        },
        {
            "fullName": "Janet Guadalupe Hernandez",
            "customerId": "CID B8D8DC06",
            "folderlinks": "https://drive.google.com/drive/folders/1Jg_5UJteGBrdZBCUAZ8eSK75tdnoUUQb"
        },
        {
            "fullName": "David Gray",
            "customerId": "CID ED165F06",
            "folderlinks": "https://drive.google.com/drive/folders/1wK1pdYSzRostZVOqBypsKamfQ2WHBjwK"
        },
        {
            "fullName": "Lynn Izakowitz",
            "customerId": "CID 82019AA9",
            "folderlinks": "https://drive.google.com/drive/folders/1TJZlRSqLnUwGxWd_1o6jBIZoqgC8kyWf"
        },
        {
            "fullName": "Alexa Kruse",
            "customerId": "CID DC3D45F8",
            "folderlinks": "https://drive.google.com/drive/folders/1BnXVCIQPLDUMRqpVta5WPSeAwiqEMFEy"
        },
        {
            "fullName": "Dana Malki",
            "customerId": "CID 2161BAE5",
            "folderlinks": "https://drive.google.com/drive/folders/1wI1DwNEQDQMzTQN727UYrJ0MZOSfJ4Lq"
        },
        {
            "fullName": "Susan Jordan C Crone",
            "customerId": "CID 0BAF9A8A",
            "folderlinks": "https://drive.google.com/drive/folders/1-fbk6XEj5aSfphRWjbveKgMUeBB0ecAV"
        },
        {
            "fullName": "Andrea Campbell",
            "customerId": "CID CC1AC4B6",
            "folderlinks": "https://drive.google.com/drive/folders/1WgZ2Try7EQIAOTK9EQsl5a_YI7gtB8PM"
        },
        {
            "fullName": "Michelle & Anthony Williamson",
            "customerId": "CID 1A1AAA31",
            "folderlinks": "https://drive.google.com/drive/folders/1fWXZ99fsBgPNaAuR8ji4-sroNnQTF6ni"
        },
        {
            "fullName": "Karly Rothenberg-Mackay",
            "customerId": "CID B7ED9DA9",
            "folderlinks": "https://drive.google.com/drive/folders/1QgW1dGHoUmZMr9eo63ZesbFflsyDC1C1"
        },
        {
            "fullName": "Carlos Muralles",
            "customerId": "CID D8E485BC",
            "folderlinks": "https://drive.google.com/drive/folders/1RfDKXBzjyTAnh0LSqkE8ELXxvBriefrv"
        },
        {
            "fullName": "Eduardo Rodriguez",
            "customerId": "CID 5B7A2BC2",
            "folderlinks": "https://drive.google.com/drive/folders/1FTnf-JMkI4K2Zg9NBHkYPJs-GH0bvU39"
        },
        {
            "fullName": "Dawn Susan Jordan-Crone",
            "customerId": "CID 63C0416A",
            "folderlinks": "https://drive.google.com/drive/folders/1sw6hRiPPInUZkL1ZwNjUtmCSCa-XJFCx"
        },
        {
            "fullName": "Anne Petersen",
            "customerId": "CID 87345188",
            "folderlinks": "https://drive.google.com/drive/folders/1izvCshqjG620PaT4KjPyAjVgt_rxD8zz"
        },
        {
            "fullName": "Maritza Duarte",
            "customerId": "CID DAFA7444",
            "folderlinks": "https://drive.google.com/drive/folders/1Nf5VlXxxhJEuzIKTTPt4C6StArOuzGS9"
        },
        {
            "fullName": "Robert & Ezrick Mejia",
            "customerId": "CID AA5FE018",
            "folderlinks": "https://drive.google.com/drive/folders/11PGkMpH454F--hQ9i3sVoCWptx4sDJS5"
        },
        {
            "fullName": "Mario Pech Urias",
            "customerId": "CID B541B449",
            "folderlinks": "https://drive.google.com/drive/folders/1TDpeLJ1xjSVvNqou6IcN2g0r56j0s6q4"
        },
        {
            "fullName": "Edward Balderrama",
            "customerId": "CID 94EBC589",
            "folderlinks": "https://drive.google.com/drive/folders/1U6WUkflqgKkLLFErpgGUNV9g7cLH-0_4"
        },
        {
            "fullName": "Keith Allen",
            "customerId": "CID 4060F4FC",
            "folderlinks": "https://drive.google.com/drive/folders/1w7_szHt6WGIQBQMMuxJpl-z9pBnaJMdc"
        },
        {
            "fullName": "Roger Anderson",
            "customerId": "CID 56BE5FAD",
            "folderlinks": "https://drive.google.com/drive/folders/1Ajyw2-SQpf5X4R_gr7YTkz8yFXidpsOR"
        },
        {
            "fullName": "John Charles JR Brown",
            "customerId": "CID B567F7DE",
            "folderlinks": "https://drive.google.com/drive/folders/14H0AlwWDD1qkv5jl_3saPYbUhPSLgvkM"
        },
        {
            "fullName": "Gladys Guillen",
            "customerId": "CID 7B9EE8D4",
            "folderlinks": "https://drive.google.com/drive/folders/1-WrofhsXfgYADLUBWZMRlvpXtatrqJEr"
        },
        {
            "fullName": "Melody Pojol",
            "customerId": "CID 7D5906D5",
            "folderlinks": "https://drive.google.com/drive/folders/1CnUk1uTsaVfJFXzcv_et7FjEL-BkruJo"
        },
        {
            "fullName": "Mark Rodgers",
            "customerId": "CID ACA48C16",
            "folderlinks": "https://drive.google.com/drive/folders/1T4ondHKav58Yvrx_G_7nzxilgAxAkG4f"
        },
        {
            "fullName": "Anna Lisa De Leon",
            "customerId": "CID CED558C8",
            "folderlinks": "https://drive.google.com/drive/folders/1G9SF5-K85iFlk7ymQlEZ-NxM20R2TkBY"
        },
        {
            "fullName": "Johnny Sebastian Solo",
            "customerId": "CID 96AE05C8",
            "folderlinks": "https://drive.google.com/drive/folders/1cZZuNhNK8naE-O8i0pJDDv5eVTsKAaV8"
        },
        {
            "fullName": "Andrew Wanzenberg",
            "customerId": "CID 5B9D6B57",
            "folderlinks": "https://drive.google.com/drive/folders/10MNt7BmEaxdmr0wouLAy2Ki2hy9qh-s2"
        },
        {
            "fullName": "Rita Deleon",
            "customerId": "CID AE75B914",
            "folderlinks": "https://drive.google.com/drive/folders/19s-YxZjjAeOhmSs1FYEUNsEmGPD8BVyw"
        },
        {
            "fullName": "Valencia Randall",
            "customerId": "CID 71B29A30",
            "folderlinks": "https://drive.google.com/drive/folders/1uEN8SAlXyvw3yV85WhjygCGnApa4Ri6R"
        },
        {
            "fullName": "MEDEARIS DAYMAN",
            "customerId": "CID 93C8A34D",
            "folderlinks": "https://drive.google.com/drive/folders/1Qn4XTk9omkAg5VR5Q38nlB-9wvE1i5NS"
        },
        {
            "fullName": "Aiman Zeidan",
            "customerId": "CID 0FECC5A1",
            "folderlinks": "https://drive.google.com/drive/folders/1quZYRLR6zhkHpUuQSr18yXMFcsMkKT6C"
        },
        {
            "fullName": "Erick and Neville Che",
            "customerId": "CID F8422172",
            "folderlinks": "https://drive.google.com/drive/folders/1AbLxIWCfOlyN1BhzqOJILpn2iGC7igGX"
        },
        {
            "fullName": "Martha Genie",
            "customerId": "CID 8C8E9624",
            "folderlinks": "https://drive.google.com/drive/folders/1cydrjFbW8_aDePc4NrP5Vcs0bB4gjwMZ"
        },
        {
            "fullName": "David Villegas",
            "customerId": "CID B497D323",
            "folderlinks": "https://drive.google.com/drive/folders/1RlkJlBQA-agnQXZWwKkRcdmrD29h3tFp"
        },
        {
            "fullName": "Gina Hattenbach",
            "customerId": "CID 18204ABC",
            "folderlinks": "https://drive.google.com/drive/folders/1o7H2l4xJd5qP0DNzv3X3-19PNRL7-5Ts"
        },
        {
            "fullName": "Gina Hattenbach",
            "customerId": "CID F2C56AE8",
            "folderlinks": "https://drive.google.com/drive/folders/1KPHg76ljOSYdoGeElFickj6TF4WzBHJT"
        },
        {
            "fullName": "Rachael Adair",
            "customerId": "CID 68A86BFA",
            "folderlinks": "https://drive.google.com/drive/folders/1-3qK81RzEGvt1m3y_ZKA4cSNAVI0plyI"
        },
        {
            "fullName": "Lonnie Bennett",
            "customerId": "CID 9FEB5012",
            "folderlinks": "https://drive.google.com/drive/folders/1h4IWapMO4BnxqIPOTzerP_PAsVulPAjf"
        },
        {
            "fullName": "Delores Judge",
            "customerId": "CID 4A628B59",
            "folderlinks": "https://drive.google.com/drive/folders/1YcgngGmYBQ-oPsPFC4DAlfJXq-BOAZMH"
        },
        {
            "fullName": "Roy Matsunaga",
            "customerId": "CID A0440681",
            "folderlinks": "https://drive.google.com/drive/folders/1XHn2akpKdNt9HMoaM_qVTj7kDugogMtn"
        },
        {
            "fullName": "Jesus Contreras",
            "customerId": "CID F48E6A8E",
            "folderlinks": "https://drive.google.com/drive/folders/1ssi10_aTHtH7vJqw5N_YE9Ihq-CFmj9M"
        },
        {
            "fullName": "Gina Hattenbach",
            "customerId": "CID 0BAC7B9B",
            "folderlinks": "https://drive.google.com/drive/folders/1C8O3qS7eCsNu0QRvLQuKs3O1Fi5Hoj-S"
        },
        {
            "fullName": "Gina Hattenbach",
            "customerId": "CID 150729FA",
            "folderlinks": "https://drive.google.com/drive/folders/1uWXJqDhafSH6UuIXZGC2KpgScKyEEAT4"
        },
        {
            "fullName": "Gina Hattenbach",
            "customerId": "CID 50D0ACF0",
            "folderlinks": "https://drive.google.com/drive/folders/1g1EFNmbra3HNf1gC8KI3f6virtX_iuE_"
        },
        {
            "fullName": "Martha Loera",
            "customerId": "CID E80DB3CC",
            "folderlinks": "https://drive.google.com/drive/folders/12AYrMMYeo5oVW1PXCyWOKOJFz3sWOGzm"
        },
        {
            "fullName": "Jane Brown",
            "customerId": "CID 4CB01869",
            "folderlinks": "https://drive.google.com/drive/folders/1Qc_LXZ7pdDFyB7v48rlzqZSuUX7qhXzd"
        },
        {
            "fullName": "Jeffrey Gerber",
            "customerId": "CID 68830092",
            "folderlinks": "https://drive.google.com/drive/folders/1OE4Y5JtpoEAzdvgb6-It1ua3OfGYF7Cp"
        },
        {
            "fullName": "Manez Preciosa",
            "customerId": "CID CB6DC0C0",
            "folderlinks": "https://drive.google.com/drive/folders/112AJRIClCgVpggBfltZwA4O0KEI4pSZt"
        },
        {
            "fullName": "Jeffrey Palmer",
            "customerId": "CID A75A2D8D",
            "folderlinks": "https://drive.google.com/drive/folders/1CJaPMgrTxnPqdWa-uB78710XN9h0bW2w"
        },
        {
            "fullName": "Ararat Ardgoli",
            "customerId": "CID 8B273DB2",
            "folderlinks": "https://drive.google.com/drive/folders/1jjsIyZDp6IN5SePRE_tGaPnUusbDaTWc"
        },
        {
            "fullName": "Juan Manrriquez Herrera",
            "customerId": "CID FB6F3F88",
            "folderlinks": "https://drive.google.com/drive/folders/1io_uRmG4x3n80VqWCv9zviU-e6gfdvVq"
        },
        {
            "fullName": "Peter Balestrieri",
            "customerId": "CID DBA7040C",
            "folderlinks": "https://drive.google.com/drive/folders/1MlbA3T72IcuFKK3g7VdHa6nwCQT1LoAF"
        },
        {
            "fullName": "Maureen Lillian Spagnolo",
            "customerId": "CID 33CD186D",
            "folderlinks": "https://drive.google.com/drive/folders/1JSsQU9qVTciPg6zxoZwvGGh765VmuwsT"
        },
        {
            "fullName": "Woodhill Cyn LLC",
            "customerId": "CID B7FFB61A",
            "folderlinks": "https://drive.google.com/drive/folders/1U-s-97j_W72-XgP9QOECNLVW2M-SrIec"
        },
        {
            "fullName": "Visitacion Ramos",
            "customerId": "CID BCE66105",
            "folderlinks": "https://drive.google.com/drive/folders/1Sj7OWoBVV5e4BIY2rdr9vcJn8JtSN9ZD"
        },
        {
            "fullName": "Hemo Hila",
            "customerId": "CID C7912F0A",
            "folderlinks": "https://drive.google.com/drive/folders/1b8oaDSPrshUFkQdNhzQoI5SFXLqJIG3e"
        },
        {
            "fullName": "Ernesto Manzo",
            "customerId": "CID 25D77065",
            "folderlinks": "https://drive.google.com/drive/folders/1-MquzMM1dK-snNwJY5bvuCgUdKYMtZTU"
        },
        {
            "fullName": "David Malka",
            "customerId": "CID 1BB36AF2",
            "folderlinks": "https://drive.google.com/drive/folders/1Anl-mM3H4ltWURNpmAQ6WRrJqUPUwv-4"
        }
    ],
    "branchName": "SWS OFFICE",
    "branchId": "91465ee7"
};

// Invoke the process and handle errors
processBranch(payload)
    .then(() => {
        console.log('Branch export completed successfully.');
    })
    .catch((err) => {
        console.error('Error processing branch:', err);
    });
