import { StyleSheet } from "react-native";

/** Shared styles for the auth screens (sign-in / sign-up). */
export const authStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  flex: { flex: 1 },
  body: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  brand: { fontSize: 28, fontWeight: "700", textAlign: "center" },
  accent: { color: "#2563eb" },
  title: { fontSize: 20, fontWeight: "600", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  btn: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  row: { flexDirection: "row", justifyContent: "center", marginTop: 8 },
  muted: { color: "#888" },
  link: { color: "#2563eb", fontWeight: "600" },
  error: { color: "#b91c1c", fontSize: 13 },
  hint: { color: "#888", fontSize: 13, textAlign: "center" },
});
