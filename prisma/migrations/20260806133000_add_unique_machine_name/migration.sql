CREATE UNIQUE INDEX "machines_machine_name_normalized_key"
ON "machines" (LOWER(BTRIM("machine_name")));
