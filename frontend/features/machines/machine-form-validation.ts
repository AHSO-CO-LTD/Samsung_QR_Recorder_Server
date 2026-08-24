export type MachineRequiredField = "machine_code" | "machine_name" | "line_name";

export function getMissingMachineRequiredFields(
  draft: Pick<Record<MachineRequiredField, string>, MachineRequiredField>,
  isEditing: boolean
): MachineRequiredField[] {
  const requiredFields: MachineRequiredField[] = isEditing ? ["machine_name", "line_name"] : ["machine_code", "machine_name", "line_name"];
  return requiredFields.filter((field) => !draft[field].trim());
}
