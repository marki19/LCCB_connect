import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { CapturedError, getCapturedErrors, subscribeToErrors, clearCapturedErrors } from '../lib/errorCapture';
import { useState, useEffect } from 'react';

export function ErrorDisplay({ limit = 20 }: { limit?: number }) {
  const [errors, setErrors] = useState<CapturedError[]>(() => getCapturedErrors().slice(0, limit));
  
  useEffect(() => {
    const unsub = subscribeToErrors((error) => {
      setErrors(prev => [error, ...prev].slice(0, limit));
    });
    return unsub;
  }, [limit]);
  
  const renderError = ({ item }: { item: CapturedError }) => (
    <View style={styles.errorItem}>
      <View style={styles.errorHeader}>
        <Text style={styles.errorType}>{item.errorType.toUpperCase()}</Text>
        <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
      </View>
      <Text style={styles.route}>Route: {item.route}</Text>
      <Text style={styles.message}>{item.message}</Text>
      {item.stack && (
        <Text style={styles.stack} numberOfLines={3}>
          {item.stack}
        </Text>
      )}
    </View>
  );
  
  if (errors.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No errors captured</Text>
        <TouchableOpacity onPress={() => clearCapturedErrors()}>
          <Text style={styles.clearButton}>Clear All</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Captured Errors ({errors.length})</Text>
        <TouchableOpacity onPress={clearCapturedErrors}>
          <Text style={styles.clearButton}>Clear</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={errors}
        renderItem={renderError}
        keyExtractor={item => item.id}
        inverted
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#333',
  },
  title: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearButton: {
    color: '#ff6b6b',
    fontSize: 14,
  },
  errorItem: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b6b',
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  errorType: {
    color: '#ff6b6b',
    fontWeight: 'bold',
    fontSize: 12,
  },
  timestamp: {
    color: '#888',
    fontSize: 12,
  },
  route: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  message: {
    color: 'white',
    fontSize: 14,
    marginBottom: 4,
  },
  stack: {
    color: '#666',
    fontSize: 10,
    fontFamily: 'monospace',
  },
});
