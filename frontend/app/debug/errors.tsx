import { ErrorDisplay } from '../../src/components/ErrorDisplay';
import { View } from 'react-native';

export default function ErrorsScreen() {
  return (
    <View style={{ flex: 1 }}>
      <ErrorDisplay />
    </View>
  );
}
