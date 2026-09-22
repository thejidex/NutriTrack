import React from 'react';
import { Switch, View } from 'react-native';
import { router } from 'expo-router';
import {
  Button,
  Field,
  Heading,
  Row,
  Screen,
  SegmentedControl,
  TextButton,
  Txt,
} from '../../components/ui';
import { useApp } from '../../hooks/useApp';
import { useAction } from '../../hooks/useAction';
import { toCsv } from '../../services/export';
import { shareExport } from '../../services/shareExport';
import { ThemeMode } from '../../types/models';
import { s } from '../../i18n/zh-CN';
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useApp();
  return (
    <View
      style={{ gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}
    >
      <Txt bold size={15}>
        {title}
      </Txt>
      {children}
    </View>
  );
}
export default function Settings() {
  const { repo, theme, setTheme, detail, setDetail, colors, homeTitle, setHomeTitle } = useApp();
  const action = useAction();
  const [titleDraft, setTitleDraft] = React.useState(homeTitle);
  const exportFile = (type: 'json' | 'csv') => {
    void action.run(async () => {
      const data = await repo.exportData();
      await shareExport(
        type === 'json' ? JSON.stringify(data, null, 2) : toCsv(data.entries, data.meals),
        type,
      );
    });
  };
  return (
    <Screen>
      <Heading title={s.settings} />
      <Group title={s.dietGoals}>
        <TextButton title={s.goals} onPress={() => router.push('/goals')} />
        <Txt size={12} muted>
          {s.goalFields}
        </Txt>
      </Group>
      <Group title={s.dietSettings}>
        <TextButton title={s.meals} onPress={() => router.push('/meals')} />
      </Group>
      <Group title={s.interfaceSettings}>
        <Txt size={12} muted>
          {s.appearanceMode}
        </Txt>
        <SegmentedControl
          options={(['system', 'light', 'dark'] as ThemeMode[]).map((value) => ({
            value,
            label: s[value],
          }))}
          value={theme}
          onChange={(value) => {
            void action.run(() => setTheme(value));
          }}
        />
        <Row>
          <Txt size={13}>{s.detail}</Txt>
          <Switch
            accessibilityLabel={s.detail}
            value={detail}
            onValueChange={(value) => {
              void action.run(() => setDetail(value));
            }}
            trackColor={{ false: colors.border, true: colors.selected }}
            thumbColor={detail ? colors.onSelected : colors.surface}
            ios_backgroundColor={colors.border}
          />
        </Row>
        <Field label={s.homeTitle} value={titleDraft} onChangeText={setTitleDraft} maxLength={40} />
        <Txt size={12} muted>
          {s.homeTitleHint}
        </Txt>
        <Button
          title={s.saveHomeTitle}
          disabled={action.busy}
          onPress={() => {
            void action.run(() => setHomeTitle(titleDraft));
          }}
        />
      </Group>
      <Group title={s.dataSection}>
        <Row style={{ justifyContent: 'flex-start' }}>
          <TextButton
            title={s.exportJson}
            disabled={action.busy}
            onPress={() => exportFile('json')}
          />
          <TextButton
            title={s.exportCsv}
            disabled={action.busy}
            onPress={() => exportFile('csv')}
          />
        </Row>
      </Group>
      <Group title={s.otherSection}>
        <Txt size={13}>{s.about} · v1.0.0</Txt>
        <Txt size={12} muted>
          {s.aboutText}
        </Txt>
        <Txt size={11} muted>
          {s.foodNote}
        </Txt>
      </Group>
    </Screen>
  );
}
