import { PERMISSIONS } from "../vairables/Permissions";

export const INDEX_ROUTE = "/users";

export const MenuRoutes = [
  {
    parentName: null,
    parentGuid: null,
    displayOrder: 0,
    uri: "users",
    permission: PERMISSIONS.USERS_READ,
    iconUri: "fa-user",
    recordGuid: "1",
    position: 100,
    group: 1,
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
    displayOrder: 1,
    uri: "devices",
    permission: PERMISSIONS.DEVICES_READ,
    iconUri: "fa-mobile",
    recordGuid: "2",
    position: 100,
    group: 1,
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
    displayOrder: 2,
    uri: "orders",
    permission: PERMISSIONS.ORDERS_READ,
    iconUri: "fa-file-invoice-dollar",
    recordGuid: "3",
    position: 100,
    group: 1,
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
    displayOrder: 3,
    uri: "contact-us",
    permission: PERMISSIONS.CONTACT_US_READ,
    iconUri: "fa-phone",
    recordGuid: "4",
    position: 100,
    group: 1,
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
    displayOrder: 3,
    uri: "groups",
    permission: PERMISSIONS.GROUPS_READ,
    iconUri: "fa-layer-group",
    recordGuid: "5",
    position: 100,
    group: 1,
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
    displayOrder: 3,
    uri: "bundles",
    permission: PERMISSIONS.BUNDLES_READ,
    iconUri: "fa-sim-card",
    recordGuid: "6",
    position: 100,
    group: 1,
    menuDetail: [
      {
        name: "Bundles",
        description: "Bundles",
        languageCode: "en",
      },
    ],
  },
  ...(import.meta.env.VITE_SUPPORT_PROMO == "true"
    ? [
        {
          parentName: null,
          parentGuid: null,
          displayOrder: 3,
          iconUri: "fa-percent",
          recordGuid: "7",
          position: 100,
          group: 1,
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
              displayOrder: 4,
              uri: "rules",
              permission: PERMISSIONS.RULES_READ,
              recordGuid: "8",
              position: 100,
              group: 1,
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
              displayOrder: 5,
              uri: "promotions",
              permission: PERMISSIONS.PROMOTIONS_READ,
              recordGuid: "9",
              position: 100,
              group: 1,
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
              displayOrder: 6,
              uri: "promo-analysis",
              permission: PERMISSIONS.PROMOTIONS_READ,
              recordGuid: "10",
              position: 100,
              group: 1,
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
      ]
    : []),
  ...(import.meta.env.VITE_APP_VOUCHER_CODE == "true"
    ? [
        {
          parentName: null,
          parentGuid: null,
          displayOrder: 7,
          uri: "vouchers",
          permission: PERMISSIONS.VOUCHERS_READ,
          iconUri: "fa-gift",
          recordGuid: "11",
          position: 100,
          group: 1,
          menuDetail: [
            {
              name: "Vouchers",
              description: "Vouchers",
              languageCode: "en",
            },
          ],
          children: [],
        },
      ]
    : []),
  ...(import.meta.env.VITE_APP_REFER_AND_EARN == "true"
    ? [
        {
          parentName: null,
          parentGuid: null,
          displayOrder: 8,
          uri: "referrals",
          permission: PERMISSIONS.REFERRALS_READ,
          iconUri: "fa-user-friends",
          recordGuid: "12",
          position: 100,
          group: 1,
          menuDetail: [
            {
              name: "Referrals",
              description: "Referrals",
              languageCode: "en",
            },
          ],
          children: [],
        },
      ]
    : []),
  {
    parentName: null,
    parentGuid: null,
    displayOrder: 9,
    uri: "settings",
    permission: PERMISSIONS.SETTINGS_READ,
    iconUri: "fa-cog",
    recordGuid: "13",
    position: 100,
    group: 1,
    menuDetail: [
      {
        name: "Settings",
        description: "Settings",
        languageCode: "en",
      },
    ],
    children: [],
  },
  {
    parentName: null,
    parentGuid: null,
    displayOrder: 10,
    uri: "audit-log",
    permission: PERMISSIONS.AUDIT_READ,
    iconUri: "fa-clipboard-list",
    recordGuid: "14",
    position: 100,
    group: 1,
    menuDetail: [
      {
        name: "Audit Log",
        description: "Audit Log",
        languageCode: "en",
      },
    ],
    children: [],
  },
  // TEOS-307
  {
    parentName: null,
    parentGuid: null,
    displayOrder: 11,
    uri: "admins",
    permission: PERMISSIONS.SECURITY_MANAGE,
    iconUri: "fa-user-shield",
    recordGuid: "15",
    position: 100,
    group: 1,
    menuDetail: [
      {
        name: "Admins",
        description: "Admins",
        languageCode: "en",
      },
    ],
    children: [],
  },
];
