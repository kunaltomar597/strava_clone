import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/Avatar";
import { TextField } from "@/components/TextField";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/theme/useTheme";
import { spacing, typeScale } from "@/theme/tokens";
import { useSearchUsers } from "@/features/social/useSearchUsers";

export default function SearchScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { data: results, isFetching } = useSearchUsers(query);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + spacing.md }}>
      <View style={{ paddingHorizontal: spacing.md }}>
        <TextField
          placeholder="Search by username or name"
          autoCapitalize="none"
          autoCorrect={false}
          value={query}
          onChangeText={setQuery}
        />
      </View>
      <FlashList
        data={results ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push(`/profile/${item.username}`)}
          >
            <Avatar avatarPath={item.avatar_path} displayName={item.display_name} size={44} />
            <View style={{ marginLeft: spacing.sm }}>
              <Text style={[typeScale.bodyBold, { color: colors.textPrimary }]}>{item.display_name}</Text>
              <Text style={[typeScale.caption, { color: colors.textSecondary }]}>@{item.username}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          !isFetching && query.trim().length > 0 ? (
            <EmptyState title="No one found" message="Try a different username or name." />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
});
