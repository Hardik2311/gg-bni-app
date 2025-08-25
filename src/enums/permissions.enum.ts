// 1. Define all possible permissions as an enum

export enum Permissions {
    // Dashboard & Reporting
    ViewDashboard = 1,
    ViewItemReport = 2,
    ViewSalesReport = 3,
    ViewPurchaseReport = 4,
    ViewPNLReport = 5,
    // Core Actions
    CreateSales = 6,
    CreateSalesReturn = 7,
    CreatePurchase = 8,
    CreatePurchaseReturn = 9,
    ManagePayments = 10,

    // Inventory & User Management
    ManageItemGroup = 11,
    ManageItems = 12,
    ManageUsers = 13,
    ManageEditProfile = 14,
    CreateUsers = 15,

    // General Access
    ViewTransactions = 16,
    SetPermissions = 17,
}
