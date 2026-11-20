"use client";

// Scaffolded from the Astryx "login" template; content replaced for ATG.
import { useState, useTransition, type CSSProperties } from "react";
import { VStack } from "@astryxdesign/core/Layout";
import { Center } from "@astryxdesign/core/Center";
import { Text, Heading } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Icon } from "@astryxdesign/core/Icon";
import { Banner } from "@astryxdesign/core/Banner";
import { CubeIcon } from "@heroicons/react/24/outline";
import { loginAction } from "@/server/actions";

// Standalone auth page paints its own body background (no host shell).
const pageStyle: CSSProperties = {
  minHeight: "100dvh",
  backgroundColor: "var(--color-background-body)",
};
const contentStyle: CSSProperties = {
  width: "100%",
  maxWidth: 400,
};

export function LoginForm({
  isDemo,
  showAccounts,
}: {
  isDemo: boolean;
  showAccounts: boolean;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSignIn = () => {
    setError("");
    if (!username || !password) {
      setError("Vui lòng nhập tên đăng nhập và mật khẩu.");
      return;
    }
    startTransition(async () => {
      const result = await loginAction(username, password);
      if (result && !result.ok) setError(result.message);
    });
  };

  return (
    <Center axis="both" padding={6} style={pageStyle}>
      <VStack gap={4} hAlign="center" style={contentStyle}>
        <VStack gap={2} hAlign="center">
          <Icon icon={CubeIcon} size="lg" />
          <Text type="body" weight="bold" size="lg">
            ATG – Phần mềm quản lý
          </Text>
        </VStack>

        <Card padding={8} width="100%">
          <VStack gap={4} hAlign="stretch">
            <VStack gap={1} hAlign="center">
              <Heading level={2}>Đăng nhập</Heading>
              <Text type="body" color="secondary" size="sm">
                Dùng tài khoản do quản trị cấp
              </Text>
            </VStack>

            {error && <Banner status="error" title={error} container="card" />}

            <TextInput
              label="Tên đăng nhập"
              value={username}
              onChange={setUsername}
              placeholder="vd: banhang"
              size="lg"
              onEnter={handleSignIn}
            />

            <TextInput
              label="Mật khẩu"
              value={password}
              onChange={setPassword}
              placeholder="Nhập mật khẩu"
              type="password"
              size="lg"
              onEnter={handleSignIn}
            />

            <Button
              label="Đăng nhập"
              variant="primary"
              size="lg"
              isLoading={isPending}
              onClick={handleSignIn}
            />
          </VStack>
        </Card>

        {showAccounts && (
          <Banner
            status="info"
            title="Tài khoản dùng thử"
            description={
              "admin / admin123 (toàn quyền) · ketoan, kho, banhang, hr / 123456" +
              (isDemo
                ? " · Bản demo: dữ liệu sẽ tự làm mới khi máy chủ khởi động lại."
                : "")
            }
            collapsible={false}
          />
        )}
      </VStack>
    </Center>
  );
}
