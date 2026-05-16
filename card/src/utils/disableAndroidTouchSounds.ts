import { Platform, Pressable, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import type { PressableProps, TouchableOpacityProps, TouchableWithoutFeedbackProps } from 'react-native';

type ComponentWithDefaults<P> = {
  defaultProps?: Partial<P>;
};

let installed = false;

function mergeDefaults<P>(component: ComponentWithDefaults<P>, defaults: Partial<P>): void {
  component.defaultProps = {
    ...(component.defaultProps ?? {}),
    ...defaults,
  };
}

export function installAndroidTouchSoundWorkaround(): void {
  if (installed || Platform.OS !== 'android') return;
  installed = true;

  mergeDefaults(TouchableOpacity as ComponentWithDefaults<TouchableOpacityProps>, {
    touchSoundDisabled: true,
  });
  mergeDefaults(TouchableWithoutFeedback as ComponentWithDefaults<TouchableWithoutFeedbackProps>, {
    touchSoundDisabled: true,
  });
  mergeDefaults(Pressable as ComponentWithDefaults<PressableProps>, {
    android_disableSound: true,
  });
}
