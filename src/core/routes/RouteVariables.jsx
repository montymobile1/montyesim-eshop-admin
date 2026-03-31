export const INDEX_ROUTE = "/users";

export const MenuRoutes = [
  {
    parentName: null,
    parentGuid: null,
    uri: "users",
    key: "users",
    iconUri: "fa-user",
    menuDetail: [
      {
        name: "Users",
        description: "Users",
        languageCode: "en",
      },
    ],
  },
  {
    parentName: null,
    parentGuid: null,
    uri: "devices",
    key: "devices",
    iconUri: "fa-mobile",
    menuDetail: [
      {
        name: "Devices",
        description: "Devices",
        languageCode: "en",
      },
    ],
  },
  {
    parentName: null,
    parentGuid: null,
    uri: "orders",
    key: "orders",
    iconUri: "fa-file-invoice-dollar",
    menuDetail: [
      {
        name: "Orders",
        description: "Orders",
        languageCode: "en",
      },
    ],
  },
  {
    parentName: null,
    parentGuid: null,
    uri: "contact-us",
    key: "contact-us",
    iconUri: "fa-phone",
    menuDetail: [
      {
        name: "Contact Us",
        description: "Contact Us",
        languageCode: "en",
      },
    ],
  },
  {
    parentName: null,
    parentGuid: null,
    uri: "groups",
    key: "groups",
    iconUri: "fa-layer-group",
    menuDetail: [
      {
        name: "Groups",
        description: "Groups",
        languageCode: "en",
      },
    ],
  },
  {
    parentName: null,
    parentGuid: null,
    uri: "bundles",
    key: "bundles",
    iconUri: "fa-sim-card",
    menuDetail: [
      {
        name: "Bundles",
        description: "Bundles",
        languageCode: "en",
      },
    ],
  },
  {
    parentName: null,
    parentGuid: null,
    iconUri: "fa-percent",
    key: "promotions-management",
    menuDetail: [
      {
        name: "Promotions Management",
        description: "Promotions Management",
        languageCode: "en",
      },
    ],
    children: [
      {
        parentName: null,
        parentGuid: null,
        uri: "rules",
        key: "rules",
        menuDetail: [
          {
            name: "Rules",
            description: "Rules",
            languageCode: "en",
          },
        ],
      },
      {
        parentName: null,
        parentGuid: null,
        uri: "promotions",
        key: "promotions",
        menuDetail: [
          {
            name: "Promotions",
            description: "Promotion",
            languageCode: "en",
          },
        ],
      },
      {
        parentName: null,
        parentGuid: null,
        uri: "promo-analysis",
        key: "promo-analysis",
        menuDetail: [
          {
            name: "Promo Analysis",
            description: "Promo Analysis",
            languageCode: "en",
          },
        ],
      },
    ],
  },
  {
    parentName: null,
    parentGuid: null,
    uri: "vouchers",
    key: "vouchers",
    iconUri: "fa-gift",
    menuDetail: [
      {
        name: "Vouchers",
        description: "Vouchers",
        languageCode: "en",
      },
    ],
    children: [],
  },
  {
    parentName: null,
    parentGuid: null,
    uri: "referrals",
    key: "referrals",
    iconUri: "fa-user-friends",
    menuDetail: [
      {
        name: "Referrals",
        description: "Referrals",
        languageCode: "en",
      },
    ],
    children: [],
  },
  // {
  //   parentName: null,
  //   parentGuid: null,
  //   uri: "banners",
  //   key: "banners",
  //   iconUri: "fa-bullhorn",
  //   menuDetail: [
  //     {
  //       name: "Banners",
  //       description: "Banners",
  //       languageCode: "en",
  //     },
  //   ],
  //   children: [],
  // },
  {
    parentName: null,
    parentGuid: null,
    uri: "settings",
    key: "settings",
    iconUri: "fa-cog",
    menuDetail: [
      {
        name: "Settings",
        description: "Settings",
        languageCode: "en",
      },
    ],
    children: [],
  },
];
