-- CreateTable
CREATE TABLE "Session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "isOnline" BOOLEAN NOT NULL DEFAULT false,
  "scope" TEXT,
  "expires" DATETIME,
  "accessToken" TEXT NOT NULL,
  "userId" BIGINT,
  "firstName" TEXT,
  "lastName" TEXT,
  "email" TEXT,
  "accountOwner" BOOLEAN NOT NULL DEFAULT false,
  "locale" TEXT,
  "collaborator" BOOLEAN DEFAULT false,
  "emailVerified" BOOLEAN DEFAULT false
);

-- CreateTable
CREATE TABLE "ShopFeature" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "config" TEXT,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "ShopFeature_shop_key_key" ON "ShopFeature"("shop", "key");

-- CreateTable
CREATE TABLE "ManagedResource" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "featureKey" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "gid" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ManagedResource_shop_kind_handle_key" ON "ManagedResource"("shop", "kind", "handle");
